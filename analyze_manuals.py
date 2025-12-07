#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
보탬e 매뉴얼 PDF 분석 스크립트
자동화 가능성 검토를 위한 매뉴얼 분석
"""

import os
import glob
from pathlib import Path
import json

try:
    import pdfplumber
    HAS_PDFPLUMBER = True
except ImportError:
    HAS_PDFPLUMBER = False
    print("pdfplumber가 설치되지 않았습니다. 설치 중...")
    import subprocess
    subprocess.check_call(["pip", "install", "pdfplumber"])
    import pdfplumber
    HAS_PDFPLUMBER = True

def extract_text_from_pdf(pdf_path):
    """PDF에서 텍스트 추출"""
    text_content = []
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page_num, page in enumerate(pdf.pages, 1):
                text = page.extract_text()
                if text:
                    text_content.append({
                        'page': page_num,
                        'text': text
                    })
    except Exception as e:
        print(f"오류 발생 ({pdf_path}): {e}")
        return None
    return text_content

def analyze_manual(pdf_path):
    """매뉴얼 분석"""
    print(f"\n분석 중: {os.path.basename(pdf_path)}")
    
    text_content = extract_text_from_pdf(pdf_path)
    if not text_content:
        return None
    
    full_text = "\n".join([page['text'] for page in text_content])
    
    # 주요 키워드 검색
    automation_keywords = [
        '입력', '등록', '수정', '삭제', '조회', '검색',
        '업로드', '다운로드', '엑셀', '일괄', '배치',
        'API', '연동', '자동', '수동', '절차', '단계',
        '버튼', '클릭', '선택', '확인', '제출', '저장',
        '로그인', '인증', '세션', '쿠키'
    ]
    
    found_keywords = {}
    for keyword in automation_keywords:
        count = full_text.count(keyword)
        if count > 0:
            found_keywords[keyword] = count
    
    # 페이지별 요약
    page_count = len(text_content)
    
    # 자동화 가능성 지표
    automation_score = 0
    automation_factors = []
    
    # 반복적인 작업 패턴 확인
    if '일괄' in full_text or '배치' in full_text:
        automation_score += 3
        automation_factors.append("일괄/배치 처리 기능 존재")
    
    if '엑셀' in full_text or 'Excel' in full_text:
        automation_score += 2
        automation_factors.append("엑셀 연동 가능성")
    
    if 'API' in full_text or '연동' in full_text:
        automation_score += 4
        automation_factors.append("API/연동 기능 존재")
    
    # 반복적인 입력 작업 확인
    input_keywords = ['입력', '등록', '저장']
    input_count = sum([full_text.count(kw) for kw in input_keywords])
    if input_count > 10:
        automation_score += 2
        automation_factors.append(f"반복 입력 작업 다수 ({input_count}회 언급)")
    
    # 복잡한 절차 확인
    if '절차' in full_text or '단계' in full_text:
        procedure_count = full_text.count('절차') + full_text.count('단계')
        if procedure_count > 5:
            automation_score += 1
            automation_factors.append(f"복잡한 절차 존재 ({procedure_count}회 언급)")
    
    return {
        'filename': os.path.basename(pdf_path),
        'page_count': page_count,
        'total_chars': len(full_text),
        'keywords': found_keywords,
        'automation_score': automation_score,
        'automation_factors': automation_factors,
        'sample_text': full_text[:1000] if len(full_text) > 1000 else full_text  # 처음 1000자만
    }

def main():
    docs_dir = Path(__file__).parent / "Docs"
    pdf_files = list(docs_dir.glob("*.pdf"))
    
    print(f"총 {len(pdf_files)}개의 PDF 파일 발견")
    print("=" * 80)
    
    results = []
    for pdf_file in sorted(pdf_files):
        result = analyze_manual(pdf_file)
        if result:
            results.append(result)
    
    # 결과 요약
    print("\n" + "=" * 80)
    print("분석 결과 요약")
    print("=" * 80)
    
    total_score = sum([r['automation_score'] for r in results])
    avg_score = total_score / len(results) if results else 0
    
    print(f"\n총 매뉴얼 수: {len(results)}")
    print(f"평균 자동화 가능성 점수: {avg_score:.2f}")
    print(f"총 자동화 가능성 점수: {total_score}")
    
    # 점수별 정렬
    results_sorted = sorted(results, key=lambda x: x['automation_score'], reverse=True)
    
    print("\n자동화 가능성 점수별 매뉴얼:")
    for i, result in enumerate(results_sorted, 1):
        print(f"\n{i}. {result['filename']}")
        print(f"   점수: {result['automation_score']}")
        print(f"   페이지: {result['page_count']}")
        if result['automation_factors']:
            print(f"   요인: {', '.join(result['automation_factors'])}")
    
    # JSON으로 저장
    output_file = Path(__file__).parent / "analysis_results.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump({
            'summary': {
                'total_manuals': len(results),
                'total_score': total_score,
                'average_score': avg_score
            },
            'results': results_sorted
        }, f, ensure_ascii=False, indent=2)
    
    print(f"\n상세 분석 결과가 {output_file}에 저장되었습니다.")
    
    # 종합 평가
    print("\n" + "=" * 80)
    print("종합 자동화 가능성 평가")
    print("=" * 80)
    
    if avg_score >= 3:
        print("✓ 자동화 가능성이 높습니다.")
        print("  - 반복적인 작업 패턴이 확인됨")
        print("  - 엑셀 연동 또는 API 기능 존재 가능성")
    elif avg_score >= 1.5:
        print("△ 자동화 가능성이 보통입니다.")
        print("  - 일부 기능은 자동화 가능")
        print("  - 전체 시스템 자동화는 제한적일 수 있음")
    else:
        print("✗ 자동화 가능성이 낮습니다.")
        print("  - 수동 작업이 많거나 복잡한 절차")
        print("  - 부분적 자동화만 가능할 수 있음")

if __name__ == "__main__":
    main()

