"""전자세금계산서 집행등록 자동화"""
from typing import Dict, Any, List
from loguru import logger

from .botame import BotameAutomation
from .config import config


class TaxInvoiceAutomation(BotameAutomation):
    """전자세금계산서 집행등록 자동화"""

    def __init__(self):
        super().__init__("전자세금계산서_집행등록")
        self.max_items = config.get('automation.tax_invoice.max_items', 100)

    async def fetch_tax_invoices(self) -> List[Dict[str, Any]]:
        """미등록 전자세금계산서 조회"""
        invoices = []

        try:
            # 집행등록 메뉴 이동
            await self.navigate_to_menu(['집행관리', '집행등록'])

            # 전자세금계산서 탭/버튼 클릭
            tax_invoice_tab = await self.page.query_selector(
                'a:has-text("전자세금계산서"), button:has-text("전자세금계산서")'
            )
            if tax_invoice_tab:
                await tax_invoice_tab.click()
                await self.page.wait_for_load_state('networkidle')

            # 홈택스 연동 조회 버튼 클릭
            fetch_btn = await self.page.query_selector(
                'button:has-text("조회"), button:has-text("세금계산서 조회")'
            )
            if fetch_btn:
                await fetch_btn.click()
                await self.page.wait_for_load_state('networkidle')

            # 전자세금계산서 목록 추출
            rows = await self.page.query_selector_all('tr.tax-invoice-row, .invoice-item')

            for row in rows[:self.max_items]:
                # 등록여부 확인
                registered = await row.query_selector('.registered, .status-registered')
                if registered:
                    continue  # 이미 등록된 건 스킵

                # 데이터 추출
                invoice = await self._extract_invoice_data(row)
                if invoice:
                    invoices.append(invoice)

            logger.info(f"미등록 전자세금계산서 {len(invoices)}건 조회 완료")
            return invoices

        except Exception as e:
            logger.error(f"세금계산서 조회 중 오류: {e}")
            await self.browser_manager.screenshot("fetch_invoice_error")
            return invoices

    async def _extract_invoice_data(self, row) -> Dict[str, Any]:
        """행에서 세금계산서 데이터 추출"""
        try:
            cells = await row.query_selector_all('td')
            if len(cells) < 6:
                return None

            return {
                'issue_date': await cells[0].inner_text(),
                'invoice_number': await cells[1].inner_text(),
                'vendor_name': await cells[2].inner_text(),
                'business_number': await cells[3].inner_text(),
                'supply_amount': await cells[4].inner_text(),
                'vat_amount': await cells[5].inner_text(),
                'total_amount': await cells[6].inner_text() if len(cells) > 6 else '',
                'element': row
            }
        except Exception as e:
            logger.warning(f"데이터 추출 중 오류: {e}")
            return None

    async def process_invoice(self, invoice: Dict[str, Any]) -> bool:
        """개별 세금계산서 집행등록"""
        try:
            vendor = invoice.get('vendor_name', 'Unknown')
            amount = invoice.get('total_amount', '0')

            logger.info(f"처리 중: {vendor} / {amount}")

            # 해당 행 선택 (체크박스 또는 클릭)
            row = invoice.get('element')
            if row:
                checkbox = await row.query_selector('input[type="checkbox"]')
                if checkbox:
                    await checkbox.check()
                else:
                    await row.click()

                await self.page.wait_for_timeout(500)

            # 집행등록 버튼 클릭
            register_btn = await self.page.query_selector('button:has-text("집행등록")')
            if register_btn:
                await register_btn.click()
                await self.page.wait_for_load_state('networkidle')

            # 집행등록 화면에서 처리
            # 거래처 정보 자동 로딩 확인
            vendor_name_field = await self.page.query_selector('input#vendorName, .vendor-name')
            if vendor_name_field:
                loaded_vendor = await vendor_name_field.input_value() if await vendor_name_field.get_attribute('type') else await vendor_name_field.inner_text()
                logger.debug(f"거래처 정보 로딩됨: {loaded_vendor}")

            # 비목/세목 자동 매핑
            budget = self.find_budget_mapping(
                invoice.get('vendor_name', ''),
                ''  # 세금계산서에는 업종 정보가 없을 수 있음
            )

            # 비목 선택
            await self._select_budget_item(budget['item'])

            # 재원구분 선택
            funding_select = await self.page.query_selector('select#fundingType, select[name="fundingType"]')
            if funding_select:
                await funding_select.select_option(label=budget['funding'])

            # 금액 검증
            supply = self._parse_amount(invoice.get('supply_amount', '0'))
            vat = self._parse_amount(invoice.get('vat_amount', '0'))
            total = self._parse_amount(invoice.get('total_amount', '0'))

            if total > 0 and supply + vat != total:
                logger.warning(f"금액 불일치: {supply} + {vat} != {total}")
                # 경고만 하고 계속 진행

            # 저장
            await self.page.click('button:has-text("저장"), button.save-btn')
            await self.page.wait_for_load_state('networkidle')

            # 성공 확인
            success_msg = await self.page.query_selector('.success-message, .alert-success')
            error_msg = await self.page.query_selector('.error-message, .alert-danger')

            if error_msg:
                error_text = await error_msg.inner_text()
                self.logger.log_item(vendor, "FAILURE", error_text)
                return False

            self.logger.log_item(vendor, "SUCCESS", f"집행등록 완료 ({amount})")
            return True

        except Exception as e:
            self.logger.log_item(invoice.get('vendor_name', 'Unknown'), "FAILURE", str(e))
            await self.browser_manager.screenshot(f"process_error_{invoice.get('invoice_number', 'unknown')}")
            return False

    async def _select_budget_item(self, budget_item: str):
        """비목 선택"""
        try:
            budget_select = await self.page.query_selector('select#budgetItem, select[name="budgetItem"]')
            if not budget_select:
                return

            options = await self.page.query_selector_all('select#budgetItem option')
            for option in options:
                text = await option.inner_text()
                if budget_item in text:
                    value = await option.get_attribute('value')
                    await self.page.select_option('select#budgetItem', value=value)
                    return

            # 기본값
            for option in options:
                text = await option.inner_text()
                if '기타' in text:
                    value = await option.get_attribute('value')
                    await self.page.select_option('select#budgetItem', value=value)
                    return

        except Exception as e:
            logger.error(f"비목 선택 중 오류: {e}")

    def _parse_amount(self, amount_str: str) -> int:
        """금액 문자열을 정수로 변환"""
        try:
            # 콤마, 원 등 제거
            cleaned = amount_str.replace(',', '').replace('원', '').replace(' ', '').strip()
            return int(cleaned) if cleaned else 0
        except:
            return 0

    async def batch_execution_request(self) -> bool:
        """일괄 집행요청"""
        try:
            # 미요청 건 필터
            status_select = await self.page.query_selector('select#executionStatus')
            if status_select:
                await status_select.select_option(label='미요청')

            await self.page.click('button:has-text("조회")')
            await self.page.wait_for_load_state('networkidle')

            # 전체 선택
            select_all = await self.page.query_selector('input.select-all, input#selectAll')
            if select_all:
                await select_all.check()

            # 집행요청 버튼
            await self.page.click('button:has-text("집행요청")')

            # 확인
            confirm = await self.page.query_selector('button:has-text("확인")')
            if confirm:
                await confirm.click()

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
            await self.start()

            if not await self.login():
                results['status'] = 'LOGIN_FAILED'
                return results

            if not await self.select_project():
                results['status'] = 'PROJECT_SELECT_FAILED'
                return results

            invoices = await self.fetch_tax_invoices()
            if not invoices:
                results['status'] = 'NO_RECORDS'
                logger.info("처리할 세금계산서가 없습니다")
                return results

            for invoice in invoices:
                success = await self.process_invoice(invoice)
                results['processed'] += 1
                if success:
                    results['success'] += 1
                else:
                    results['failure'] += 1

            if results['success'] > 0:
                await self.batch_execution_request()

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
    automation = TaxInvoiceAutomation()
    result = await automation.run()
    print(f"실행 결과: {result}")
    return result


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
