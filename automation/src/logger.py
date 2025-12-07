"""로깅 모듈"""
import sys
from datetime import datetime
from pathlib import Path
from loguru import logger


def setup_logger(log_file: str = "logs/automation.log"):
    """로거 설정"""
    # 로그 디렉토리 생성
    log_path = Path(log_file)
    log_path.parent.mkdir(parents=True, exist_ok=True)

    # 기본 로거 제거
    logger.remove()

    # 콘솔 출력
    logger.add(
        sys.stdout,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
               "<level>{level: <8}</level> | "
               "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> | "
               "<level>{message}</level>",
        level="INFO"
    )

    # 파일 출력
    logger.add(
        log_file,
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} | {message}",
        level="DEBUG",
        rotation="10 MB",
        retention="30 days",
        encoding="utf-8"
    )

    return logger


class AutomationLogger:
    """자동화 실행 로거"""

    def __init__(self, automation_type: str):
        self.automation_type = automation_type
        self.execution_id = datetime.now().strftime('%Y%m%d%H%M%S')
        self.results = []
        self.errors = []

    def log_start(self, params: dict):
        """자동화 시작 로그"""
        logger.info(f"[{self.execution_id}] {self.automation_type} 시작")
        logger.info(f"[{self.execution_id}] 파라미터: {params}")

    def log_item(self, item_id: str, status: str, message: str = None):
        """개별 항목 처리 로그"""
        log_msg = f"[{self.execution_id}] {item_id}: {status}"
        if message:
            log_msg += f" - {message}"

        if status == "SUCCESS":
            logger.success(log_msg)
            self.results.append({'item_id': item_id, 'status': status})
        elif status == "FAILURE":
            logger.error(log_msg)
            self.errors.append({'item_id': item_id, 'status': status, 'message': message})
        else:
            logger.info(log_msg)

    def log_end(self):
        """자동화 종료 로그"""
        summary = {
            'total': len(self.results) + len(self.errors),
            'success': len(self.results),
            'failure': len(self.errors)
        }
        logger.info(f"[{self.execution_id}] {self.automation_type} 완료")
        logger.info(f"[{self.execution_id}] 결과: 성공 {summary['success']}건, 실패 {summary['failure']}건")
        return summary


# 로거 초기화
setup_logger()
