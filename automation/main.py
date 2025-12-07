#!/usr/bin/env python3
"""보탬e 자동화 메인 실행 스크립트"""
import asyncio
import argparse
import sys
from typing import Dict, Any

from loguru import logger
from src.card_usage_automation import CardUsageAutomation
from src.tax_invoice_automation import TaxInvoiceAutomation
from src.transfer_automation import TransferAutomation


AUTOMATION_TYPES = {
    'card': {
        'class': CardUsageAutomation,
        'name': '카드사용내역 집행등록',
        'description': '미사용 카드내역을 조회하여 자동으로 집행등록합니다.'
    },
    'tax': {
        'class': TaxInvoiceAutomation,
        'name': '전자세금계산서 집행등록',
        'description': '미등록 전자세금계산서를 조회하여 자동으로 집행등록합니다.'
    },
    'transfer': {
        'class': TransferAutomation,
        'name': '집행이체 일괄처리',
        'description': '이체 대기건을 선택하고 일괄이체합니다. (인증서 인증 필요)'
    }
}


def print_banner():
    """배너 출력"""
    banner = """
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║       보탬e 자동화 시스템 (지방보조금관리시스템)          ║
║                                                           ║
║       Version: 1.0.0                                      ║
║       Python: 3.9+                                        ║
║       Playwright: 1.40.0                                  ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    """
    print(banner)


def list_automations():
    """사용 가능한 자동화 목록 출력"""
    print("\n사용 가능한 자동화:")
    print("-" * 50)
    for key, info in AUTOMATION_TYPES.items():
        print(f"  {key:12} - {info['name']}")
        print(f"               {info['description']}")
        print()


async def run_automation(automation_type: str, **kwargs) -> Dict[str, Any]:
    """자동화 실행"""
    if automation_type not in AUTOMATION_TYPES:
        logger.error(f"알 수 없는 자동화 타입: {automation_type}")
        list_automations()
        return {'status': 'INVALID_TYPE'}

    info = AUTOMATION_TYPES[automation_type]
    logger.info(f"[{info['name']}] 자동화 시작")

    try:
        automation = info['class']()
        result = await automation.run(**kwargs)
        return result
    except Exception as e:
        logger.error(f"자동화 실행 실패: {e}")
        return {'status': 'ERROR', 'error': str(e)}


async def run_all_automations():
    """모든 자동화 순차 실행"""
    results = {}

    # 실행 순서: card -> tax -> transfer
    for automation_type in ['card', 'tax', 'transfer']:
        info = AUTOMATION_TYPES[automation_type]
        logger.info(f"\n{'='*50}")
        logger.info(f"[{info['name']}] 시작")
        logger.info(f"{'='*50}")

        result = await run_automation(automation_type)
        results[automation_type] = result

        if result.get('status') not in ['COMPLETED', 'NO_RECORDS']:
            logger.warning(f"[{info['name']}] 완료되지 않음: {result.get('status')}")
            # 이체 자동화가 아닌 경우만 계속 진행
            if automation_type != 'transfer':
                continue

        logger.success(f"[{info['name']}] 완료")

    return results


def print_summary(results: Dict[str, Any]):
    """결과 요약 출력"""
    print("\n" + "=" * 50)
    print("실행 결과 요약")
    print("=" * 50)

    if isinstance(results, dict) and 'status' in results:
        # 단일 자동화 결과
        print(f"상태: {results.get('status')}")
        print(f"처리: {results.get('processed', 0)}건")
        print(f"성공: {results.get('success', 0)}건")
        print(f"실패: {results.get('failure', 0)}건")
    else:
        # 다중 자동화 결과
        for auto_type, result in results.items():
            info = AUTOMATION_TYPES.get(auto_type, {'name': auto_type})
            print(f"\n[{info['name']}]")
            print(f"  상태: {result.get('status')}")
            print(f"  처리: {result.get('processed', 0)}건")
            print(f"  성공: {result.get('success', 0)}건")
            print(f"  실패: {result.get('failure', 0)}건")

    print("\n" + "=" * 50)


def main():
    """메인 함수"""
    parser = argparse.ArgumentParser(
        description='보탬e 자동화 시스템',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
예시:
  python main.py card              # 카드사용내역 집행등록 실행
  python main.py tax               # 전자세금계산서 집행등록 실행
  python main.py transfer          # 집행이체 일괄처리 실행
  python main.py all               # 모든 자동화 순차 실행
  python main.py --list            # 사용 가능한 자동화 목록
        """
    )

    parser.add_argument(
        'type',
        nargs='?',
        choices=list(AUTOMATION_TYPES.keys()) + ['all'],
        help='실행할 자동화 타입'
    )

    parser.add_argument(
        '--list', '-l',
        action='store_true',
        help='사용 가능한 자동화 목록 표시'
    )

    parser.add_argument(
        '--no-banner',
        action='store_true',
        help='배너 출력 생략'
    )

    args = parser.parse_args()

    if not args.no_banner:
        print_banner()

    if args.list:
        list_automations()
        return 0

    if not args.type:
        parser.print_help()
        list_automations()
        return 1

    try:
        if args.type == 'all':
            results = asyncio.run(run_all_automations())
        else:
            results = asyncio.run(run_automation(args.type))

        print_summary(results)

        # 성공 여부에 따른 종료 코드
        if isinstance(results, dict):
            status = results.get('status', '')
            if status in ['COMPLETED', 'NO_RECORDS']:
                return 0
            else:
                return 1
        return 0

    except KeyboardInterrupt:
        logger.warning("\n사용자에 의해 중단됨")
        return 130
    except Exception as e:
        logger.error(f"예상치 못한 오류: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
