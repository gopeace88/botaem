"""설정 관리 모듈"""
import os
import yaml
from pathlib import Path
from typing import Any, Dict, Optional
from dotenv import load_dotenv


class Config:
    """설정 관리자"""

    def __init__(self, config_path: str = "config/settings.yaml"):
        # 환경변수 로드
        load_dotenv()

        # 설정 파일 로드
        self.config_path = Path(config_path)
        self._config = self._load_config()

    def _load_config(self) -> Dict[str, Any]:
        """설정 파일 로드 및 환경변수 치환"""
        if not self.config_path.exists():
            raise FileNotFoundError(f"설정 파일을 찾을 수 없습니다: {self.config_path}")

        with open(self.config_path, 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f)

        # 환경변수 치환
        return self._substitute_env_vars(config)

    def _substitute_env_vars(self, obj: Any) -> Any:
        """${VAR} 형식의 환경변수 치환"""
        if isinstance(obj, dict):
            return {k: self._substitute_env_vars(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self._substitute_env_vars(item) for item in obj]
        elif isinstance(obj, str) and obj.startswith("${") and obj.endswith("}"):
            env_var = obj[2:-1]
            return os.getenv(env_var, "")
        return obj

    def get(self, key: str, default: Any = None) -> Any:
        """점 표기법으로 설정값 조회 (예: 'botame.url')"""
        keys = key.split('.')
        value = self._config

        for k in keys:
            if isinstance(value, dict) and k in value:
                value = value[k]
            else:
                return default

        return value

    @property
    def botame_url(self) -> str:
        return self.get('botame.url')

    @property
    def user_id(self) -> str:
        return self.get('credentials.user_id')

    @property
    def password(self) -> str:
        return self.get('credentials.password')

    @property
    def transfer_password(self) -> str:
        return self.get('credentials.transfer_password')

    @property
    def fiscal_year(self) -> str:
        return self.get('project.fiscal_year')

    @property
    def project_code(self) -> str:
        return self.get('project.project_code')

    @property
    def budget_mapping_rules(self) -> list:
        return self.get('budget_mapping.rules', [])

    @property
    def default_budget(self) -> dict:
        return self.get('budget_mapping.default', {})

    @property
    def is_headless(self) -> bool:
        return self.get('browser.headless', False)

    @property
    def slow_mo(self) -> int:
        return self.get('browser.slow_mo', 100)


# 전역 설정 인스턴스
config = Config()
