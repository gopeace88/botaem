"""설정 테스트"""
import pytest
from src.config import config


def test_config_loads():
    """설정 파일 로딩 테스트"""
    assert config is not None


def test_botame_url():
    """보탬e URL 설정 확인"""
    url = config.botame_url
    assert url is not None
    assert 'botame' in url.lower() or 'localhost' in url


def test_fiscal_year():
    """회계연도 설정 확인"""
    fy = config.fiscal_year
    assert fy is not None
    assert len(fy) == 4  # YYYY 형식


def test_budget_mapping_rules():
    """비목 매핑 규칙 존재 확인"""
    rules = config.budget_mapping_rules
    assert isinstance(rules, list)
    assert len(rules) > 0


def test_default_budget():
    """기본 비목 설정 확인"""
    default = config.default_budget
    assert 'budget_item' in default
    assert 'funding_type' in default
