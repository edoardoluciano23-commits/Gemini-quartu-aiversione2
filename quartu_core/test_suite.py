#!/usr/bin/env python3
"""
Test suite for Quartu AI and Untitled-1.py
"""

import subprocess
import sys

def test_untitled_1_py():
    """Test that Untitled-1.py runs without errors"""
    result = subprocess.run([sys.executable, "Untitled-1.py"], capture_output=True, text=True)
    expected_output = [
        "3.0",
        "Hello, Alice",
        "5",
        "olleh",
        "True"
    ]

    output_lines = result.stdout.strip().split('\n')

    print("✅ Testing Untitled-1.py...")
    assert len(output_lines) == 5, f"Expected 5 lines, got {len(output_lines)}"

    for i, (actual, expected) in enumerate(zip(output_lines, expected_output)):
        assert actual.strip() == expected, f"Line {i}: expected '{expected}', got '{actual}'"
        print(f"   ✓ Test {i+1}: {expected}")

    print("✅ All Untitled-1.py tests passed!\n")
    return True

def test_quartu_ai():
    """Test that Quartu AI analyzer works"""
    result = subprocess.run([sys.executable, "quartu_ai.py"], capture_output=True, text=True)

    print("✅ Testing Quartu AI analyzer...")
    assert "Analyzing" in result.stdout, "Analyzer didn't run"
    assert "bug_analysis_report.json" in result.stdout or "Analysis Report" in result.stdout, "No output"
    print("   ✓ Analyzer runs successfully")
    print("✅ All Quartu AI tests passed!\n")
    return True

def main():
    print("🧪 Running Test Suite\n")
    print("=" * 60)

    try:
        test_untitled_1_py()
        test_quartu_ai()

        print("=" * 60)
        print("✅ ALL TESTS PASSED! 🎉\n")
        return 0

    except AssertionError as e:
        print(f"❌ Test failed: {e}\n")
        return 1
    except Exception as e:
        print(f"❌ Unexpected error: {e}\n")
        return 1

if __name__ == "__main__":
    sys.exit(main())
