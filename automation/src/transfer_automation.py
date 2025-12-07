"""집행이체 일괄처리 자동화"""
from typing import Dict, Any, List
from loguru import logger

from .botame import BotameAutomation
from .config import config


class TransferAutomation(BotameAutomation):
    """집행이체 일괄처리 자동화

    Note: 인증서 인증이 필요하여 반자동화 방식으로 운영
    - 이체 대상 목록 조회 및 선택: 자동화
    - 인증서 인증: 수동 (사용자 개입 필요)
    - 이체 실행 후 결과 확인: 자동화
    """

    def __init__(self):
        super().__init__("집행이체_일괄처리")
        self.max_items = config.get('automation.transfer.max_items', 30)
        self.wait_for_auth_timeout = config.get('automation.transfer.auth_timeout', 120000)

    async def fetch_pending_transfers(self) -> List[Dict[str, Any]]:
        """이체 대기 건 조회"""
        transfers = []

        try:
            # 집행관리 > 집행이체관리 메뉴 이동
            await self.navigate_to_menu(['집행관리', '집행이체관리'])

            # 조회 조건 설정
            await self.page.select_option('select#fiscalYear', self.fiscal_year)

            # 이체상태: 미이체
            status_select = await self.page.query_selector('select#transferStatus')
            if status_select:
                await status_select.select_option(label='미이체')

            # 조회 버튼 클릭
            await self.page.click('button:has-text("조회")')
            await self.page.wait_for_load_state('networkidle')

            # 이체 대기 목록 추출
            rows = await self.page.query_selector_all('tr.transfer-row, .transfer-item')

            for row in rows[:self.max_items]:
                # 이체 가능 여부 확인
                status_cell = await row.query_selector('.transfer-status, td.status')
                if status_cell:
                    status_text = await status_cell.inner_text()
                    if '완료' in status_text or '이체됨' in status_text:
                        continue

                # 데이터 추출
                transfer = await self._extract_transfer_data(row)
                if transfer:
                    transfers.append(transfer)

            logger.info(f"이체 대기건 {len(transfers)}건 조회 완료")
            return transfers

        except Exception as e:
            logger.error(f"이체 대기건 조회 중 오류: {e}")
            await self.browser_manager.screenshot("fetch_transfer_error")
            return transfers

    async def _extract_transfer_data(self, row) -> Dict[str, Any]:
        """행에서 이체 데이터 추출"""
        try:
            cells = await row.query_selector_all('td')
            if len(cells) < 7:
                return None

            return {
                'execution_number': await cells[0].inner_text(),
                'vendor_name': await cells[1].inner_text(),
                'bank_name': await cells[2].inner_text(),
                'account_number': await cells[3].inner_text(),
                'amount': await cells[4].inner_text(),
                'budget_item': await cells[5].inner_text(),
                'request_date': await cells[6].inner_text() if len(cells) > 6 else '',
                'element': row
            }
        except Exception as e:
            logger.warning(f"데이터 추출 중 오류: {e}")
            return None

    async def select_transfers(self, transfers: List[Dict[str, Any]]) -> int:
        """이체 대상 선택"""
        selected = 0
        try:
            for transfer in transfers:
                row = transfer.get('element')
                if row:
                    checkbox = await row.query_selector('input[type="checkbox"]')
                    if checkbox:
                        await checkbox.check()
                        selected += 1
                        logger.debug(f"선택: {transfer.get('vendor_name')} / {transfer.get('amount')}")

            logger.info(f"이체 대상 {selected}건 선택 완료")
            return selected

        except Exception as e:
            logger.error(f"이체 대상 선택 중 오류: {e}")
            return selected

    async def initiate_transfer(self) -> bool:
        """이체 시작 (인증 화면까지)"""
        try:
            # 일괄이체 버튼 클릭
            transfer_btn = await self.page.query_selector('button:has-text("일괄이체"), button:has-text("이체실행")')
            if transfer_btn:
                await transfer_btn.click()
                await self.page.wait_for_load_state('networkidle')

            # 이체 확인 팝업
            confirm_btn = await self.page.query_selector('button:has-text("확인"), .confirm-btn')
            if confirm_btn:
                await confirm_btn.click()

            logger.info("이체 요청 시작 - 인증서 인증 대기 중...")
            return True

        except Exception as e:
            logger.error(f"이체 시작 중 오류: {e}")
            return False

    async def wait_for_authentication(self) -> bool:
        """인증서 인증 대기 (사용자 수동 입력)"""
        try:
            logger.warning("=" * 50)
            logger.warning("인증서 인증이 필요합니다!")
            logger.warning("브라우저에서 인증서를 선택하고 비밀번호를 입력해주세요.")
            logger.warning(f"대기 시간: {self.wait_for_auth_timeout / 1000}초")
            logger.warning("=" * 50)

            # 인증 완료 대기 (성공 메시지 또는 결과 화면)
            try:
                await self.page.wait_for_selector(
                    '.success-message, .transfer-result, .alert-success',
                    timeout=self.wait_for_auth_timeout
                )
                logger.success("인증 완료 감지")
                return True
            except:
                # 타임아웃 - 인증 창이 닫혔는지 확인
                auth_popup = await self.page.query_selector('.cert-popup, .auth-dialog')
                if not auth_popup:
                    # 인증 창이 닫혔으면 성공으로 간주
                    logger.info("인증 창 닫힘 감지 - 인증 완료로 처리")
                    return True
                else:
                    logger.error("인증 타임아웃")
                    return False

        except Exception as e:
            logger.error(f"인증 대기 중 오류: {e}")
            return False

    async def verify_transfer_result(self, transfers: List[Dict[str, Any]]) -> Dict[str, Any]:
        """이체 결과 확인"""
        result = {
            'total': len(transfers),
            'success': 0,
            'failure': 0,
            'details': []
        }

        try:
            await self.page.wait_for_load_state('networkidle')

            # 결과 화면에서 각 건별 상태 확인
            result_rows = await self.page.query_selector_all('.result-row, .transfer-result-item')

            for row in result_rows:
                status_cell = await row.query_selector('.result-status, td.status')
                vendor_cell = await row.query_selector('.vendor-name, td:nth-child(2)')

                if status_cell and vendor_cell:
                    status = await status_cell.inner_text()
                    vendor = await vendor_cell.inner_text()

                    if '성공' in status or '완료' in status:
                        result['success'] += 1
                        self.logger.log_item(vendor, "SUCCESS", "이체 완료")
                    else:
                        result['failure'] += 1
                        self.logger.log_item(vendor, "FAILURE", status)

                    result['details'].append({
                        'vendor': vendor,
                        'status': status
                    })

            # 결과 요약 로그
            logger.info(f"이체 결과: 성공 {result['success']}건, 실패 {result['failure']}건")
            return result

        except Exception as e:
            logger.error(f"결과 확인 중 오류: {e}")
            return result

    async def run(self, auto_auth: bool = False) -> Dict[str, Any]:
        """자동화 실행

        Args:
            auto_auth: True면 인증 대기 없이 진행 (테스트용)
        """
        self.logger.log_start({
            'fiscal_year': self.fiscal_year,
            'project_code': self.project_code,
            'max_items': self.max_items,
            'auto_auth': auto_auth
        })

        results = {
            'status': 'STARTED',
            'selected': 0,
            'transferred': 0,
            'success': 0,
            'failure': 0
        }

        try:
            await self.start()

            if not await self.login():
                results['status'] = 'LOGIN_FAILED'
                return results

            if not await self.select_project():
                results['status'] = 'PROJECT_SELECT_FAILED'
                return results

            # 이체 대기건 조회
            transfers = await self.fetch_pending_transfers()
            if not transfers:
                results['status'] = 'NO_RECORDS'
                logger.info("이체 대기건이 없습니다")
                return results

            # 이체 대상 선택
            selected = await self.select_transfers(transfers)
            results['selected'] = selected

            if selected == 0:
                results['status'] = 'NO_SELECTION'
                return results

            # 이체 시작
            if not await self.initiate_transfer():
                results['status'] = 'TRANSFER_INIT_FAILED'
                return results

            # 인증 대기 (반자동화 핵심)
            if not auto_auth:
                if not await self.wait_for_authentication():
                    results['status'] = 'AUTH_FAILED'
                    return results

            # 결과 확인
            transfer_result = await self.verify_transfer_result(transfers)
            results['transferred'] = transfer_result['total']
            results['success'] = transfer_result['success']
            results['failure'] = transfer_result['failure']
            results['status'] = 'COMPLETED'

        except Exception as e:
            logger.error(f"자동화 실행 중 오류: {e}")
            results['status'] = 'ERROR'
            results['error'] = str(e)

        finally:
            await self.stop()
            self.logger.log_end()

        return results


async def main():
    """메인 실행 함수"""
    automation = TransferAutomation()
    result = await automation.run()
    print(f"실행 결과: {result}")
    return result


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
