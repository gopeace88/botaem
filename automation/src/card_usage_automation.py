"""카드사용내역 집행등록 자동화"""
from typing import Dict, Any, List
from loguru import logger

from .botame import BotameAutomation
from .config import config


class CardUsageAutomation(BotameAutomation):
    """보조금전용카드 사용내역 집행등록 자동화"""

    def __init__(self):
        super().__init__("카드사용내역_집행등록")
        self.max_items = config.get('automation.card_usage.max_items', 50)

    async def fetch_unused_records(self) -> List[Dict[str, Any]]:
        """미사용 카드사용내역 조회"""
        records = []

        try:
            # 카드사용내역관리 메뉴 이동
            await self.navigate_to_menu(['금융정보관리', '보조금카드관리', '보조금전용카드사용내역관리'])

            # 조회 조건 설정
            await self.page.select_option('select#fiscalYear', self.fiscal_year)

            # 미사용 내역만 필터 (체크박스가 있다면)
            unused_checkbox = await self.page.query_selector('input#unusedOnly, input[name="unusedOnly"]')
            if unused_checkbox:
                await unused_checkbox.check()

            # 조회 버튼 클릭
            await self.page.click('button:has-text("조회")')
            await self.page.wait_for_load_state('networkidle')

            # 미사용 내역 추출 (셀렉터는 실제 화면에 맞게 수정 필요)
            rows = await self.page.query_selector_all('tr.card-usage-row, .card-usage-item')

            for row in rows[:self.max_items]:
                # 사용여부 확인
                used_cell = await row.query_selector('.used-status, td:last-child')
                if used_cell:
                    used_text = await used_cell.inner_text()
                    if 'Y' in used_text or '사용' in used_text:
                        continue  # 이미 사용된 건 스킵

                # 데이터 추출
                record = await self._extract_record_data(row)
                if record:
                    records.append(record)

            logger.info(f"미사용 카드내역 {len(records)}건 조회 완료")
            return records

        except Exception as e:
            logger.error(f"카드내역 조회 중 오류: {e}")
            await self.browser_manager.screenshot("fetch_card_error")
            return records

    async def _extract_record_data(self, row) -> Dict[str, Any]:
        """행에서 데이터 추출"""
        try:
            cells = await row.query_selector_all('td')
            if len(cells) < 5:
                return None

            return {
                'transaction_date': await cells[0].inner_text(),
                'approval_number': await cells[1].inner_text(),
                'amount': await cells[2].inner_text(),
                'merchant_name': await cells[3].inner_text(),
                'business_type': await cells[4].inner_text() if len(cells) > 4 else '',
                'element': row
            }
        except Exception as e:
            logger.warning(f"데이터 추출 중 오류: {e}")
            return None

    async def process_record(self, record: Dict[str, Any]) -> bool:
        """개별 카드내역 집행등록"""
        try:
            merchant = record.get('merchant_name', 'Unknown')
            amount = record.get('amount', '0')

            logger.info(f"처리 중: {merchant} / {amount}")

            # 해당 행의 집행등록 버튼 클릭 (또는 체크박스 선택 후 일괄 등록)
            row = record.get('element')
            if row:
                register_btn = await row.query_selector('button:has-text("집행등록"), a:has-text("등록")')
                if register_btn:
                    await register_btn.click()
                    await self.page.wait_for_load_state('networkidle')

            # 집행등록 화면/팝업에서 처리
            # 증빙유형 선택
            evidence_select = await self.page.query_selector('select#evidenceType, select[name="evidenceType"]')
            if evidence_select:
                await evidence_select.select_option(value='신용카드')

            # 비목/세목 자동 매핑
            budget = self.find_budget_mapping(
                record.get('merchant_name', ''),
                record.get('business_type', '')
            )

            # 비목 선택
            budget_item_select = await self.page.query_selector('select#budgetItem, select[name="budgetItem"]')
            if budget_item_select:
                # 옵션에서 해당 비목 찾아서 선택
                await self._select_budget_item(budget['item'])

            # 재원구분 선택
            funding_select = await self.page.query_selector('select#fundingType, select[name="fundingType"]')
            if funding_select:
                await funding_select.select_option(label=budget['funding'])

            # 저장
            await self.page.click('button:has-text("저장"), button.save-btn')
            await self.page.wait_for_load_state('networkidle')

            # 성공 확인
            success_msg = await self.page.query_selector('.success-message, .alert-success')
            if success_msg:
                self.logger.log_item(merchant, "SUCCESS", f"집행등록 완료 ({amount})")
                return True
            else:
                self.logger.log_item(merchant, "FAILURE", "저장 실패")
                return False

        except Exception as e:
            self.logger.log_item(record.get('merchant_name', 'Unknown'), "FAILURE", str(e))
            await self.browser_manager.screenshot(f"process_error_{record.get('approval_number', 'unknown')}")
            return False

    async def _select_budget_item(self, budget_item: str):
        """비목 선택 (옵션 텍스트로 검색)"""
        try:
            # 비목 선택 셀렉트 박스에서 해당 비목 찾기
            options = await self.page.query_selector_all('select#budgetItem option')
            for option in options:
                text = await option.inner_text()
                if budget_item in text:
                    value = await option.get_attribute('value')
                    await self.page.select_option('select#budgetItem', value=value)
                    return

            # 못 찾으면 기타운영비로 선택
            logger.warning(f"비목 '{budget_item}' 못 찾음, 기타운영비 선택")
            for option in options:
                text = await option.inner_text()
                if '기타' in text:
                    value = await option.get_attribute('value')
                    await self.page.select_option('select#budgetItem', value=value)
                    return

        except Exception as e:
            logger.error(f"비목 선택 중 오류: {e}")

    async def batch_execution_request(self) -> bool:
        """일괄 집행요청"""
        try:
            # 집행관리 > 집행등록 화면으로 이동
            await self.navigate_to_menu(['집행관리', '집행등록'])

            # 미요청 건 필터
            await self.page.select_option('select#executionStatus', '미요청')
            await self.page.click('button:has-text("조회")')
            await self.page.wait_for_load_state('networkidle')

            # 전체 선택
            select_all = await self.page.query_selector('input.select-all, input#selectAll')
            if select_all:
                await select_all.check()

            # 집행요청 버튼 클릭
            await self.page.click('button:has-text("집행요청")')

            # 확인 다이얼로그
            confirm_btn = await self.page.query_selector('button:has-text("확인"), button.confirm')
            if confirm_btn:
                await confirm_btn.click()

            await self.page.wait_for_load_state('networkidle')

            logger.success("일괄 집행요청 완료")
            return True

        except Exception as e:
            logger.error(f"일괄 집행요청 중 오류: {e}")
            return False

    async def run(self) -> Dict[str, Any]:
        """자동화 실행"""
        self.logger.log_start({
            'fiscal_year': self.fiscal_year,
            'project_code': self.project_code,
            'max_items': self.max_items
        })

        results = {
            'status': 'STARTED',
            'processed': 0,
            'success': 0,
            'failure': 0
        }

        try:
            # 브라우저 시작
            await self.start()

            # 로그인
            if not await self.login():
                results['status'] = 'LOGIN_FAILED'
                return results

            # 보조사업 선택
            if not await self.select_project():
                results['status'] = 'PROJECT_SELECT_FAILED'
                return results

            # 미사용 카드내역 조회
            records = await self.fetch_unused_records()
            if not records:
                results['status'] = 'NO_RECORDS'
                logger.info("처리할 카드내역이 없습니다")
                return results

            # 건별 처리
            for record in records:
                success = await self.process_record(record)
                results['processed'] += 1
                if success:
                    results['success'] += 1
                else:
                    results['failure'] += 1

            # 일괄 집행요청
            if results['success'] > 0:
                await self.batch_execution_request()

            results['status'] = 'COMPLETED'

        except Exception as e:
            logger.error(f"자동화 실행 중 오류: {e}")
            results['status'] = 'ERROR'
            results['error'] = str(e)

        finally:
            # 브라우저 종료
            await self.stop()
            # 로그 종료
            self.logger.log_end()

        return results


async def main():
    """메인 실행 함수"""
    automation = CardUsageAutomation()
    result = await automation.run()
    print(f"실행 결과: {result}")
    return result


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
