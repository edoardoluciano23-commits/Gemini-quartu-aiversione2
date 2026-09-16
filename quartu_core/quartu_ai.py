#!/usr/bin/env python3
"""
Quartu AI - Intelligent bug finder and fixer
Simplified version with local bug detection
"""

import re
import json
from pathlib import Path

def find_syntax_bugs(code: str) -> list:
    """Find common syntax bugs"""
    bugs = []
    lines = code.split('\n')

    for i, line in enumerate(lines, 1):
        # Missing colons after if/for/while/def/class
        if re.match(r'^\s*(if|for|while|def|class|elif|else|try|except|finally)\s', line) and not line.rstrip().endswith(':'):
            bugs.append({
                "line": i,
                "type": "SyntaxError",
                "description": f"Missing colon after {line.strip().split()[0]}",
                "severity": "critical",
                "fix": line.rstrip() + ":"
            })

        # Assignment instead of comparison
        if re.search(r'\bif\s+.*\s=\s+', line) and '==' not in line:
            bugs.append({
                "line": i,
                "type": "LogicError",
                "description": "Using assignment (=) instead of comparison (==)",
                "severity": "critical",
                "fix": line.replace(' = ', ' == ')
            })

        # Undefined variables
        if '=' in line and not line.strip().startswith('#'):
            var_name = line.split('=')[0].strip()
            if var_name and not any(char.isalpha() for char in var_name):
                continue

    return bugs

def find_logic_bugs(code: str) -> list:
    """Find common logic bugs"""
    bugs = []
    lines = code.split('\n')

    for i, line in enumerate(lines, 1):
        # += instead of =
        if re.search(r'(\w+)\s*=\s*(\1|[a-z]+)\b', line) and '+=' not in line and 'return' not in line:
            if i < len(lines) - 1:
                next_line = lines[i]
                if '+=' in next_line and re.search(r'(\w+)\s*\+=', line):
                    bugs.append({
                        "line": i,
                        "type": "LogicError",
                        "description": "Variable overwritten instead of accumulated",
                        "severity": "high",
                        "fix": "Consider using += for accumulation"
                    })

    return bugs

def find_naming_bugs(code: str) -> list:
    """Find naming errors and typos"""
    bugs = []
    lines = code.split('\n')
    used_vars = set()
    defined_vars = set()

    for i, line in enumerate(lines, 1):
        # Find variable definitions
        if '=' in line and 'def' not in line:
            matches = re.findall(r'(\w+)\s*=', line)
            defined_vars.update(matches)

        # Find variable usages
        matches = re.findall(r'\b([a-z_]\w+)\b', line)
        used_vars.update(matches)

    # Check for typos
    for var in used_vars:
        if var not in defined_vars and var not in ['if', 'for', 'while', 'def', 'class', 'return', 'range', 'len', 'print', 'True', 'False']:
            # Look for similar variable names
            for defined in defined_vars:
                if defined.lower() != var.lower() and abs(len(defined) - len(var)) <= 2:
                    bugs.append({
                        "line": 0,
                        "type": "NameError",
                        "description": f"Possible typo: '{var}' similar to '{defined}'",
                        "severity": "high",
                        "fix": f"Replace '{var}' with '{defined}'"
                    })
                    break

    return bugs

def analyze_code_quality(code: str) -> dict:
    """Analyze overall code quality"""
    lines = code.split('\n')
    functions = len(re.findall(r'def\s+\w+', code))
    classes = len(re.findall(r'class\s+\w+', code))
    comments = len([l for l in lines if l.strip().startswith('#')])

    quality_score = min(100, 60 + functions * 5 + classes * 3 + (comments * 2 if comments > 0 else 0))

    return {
        "functions": functions,
        "classes": classes,
        "comments": comments,
        "overall_quality": f"{quality_score}%",
        "lines_of_code": len(lines)
    }

def process_file(filepath: str) -> tuple[dict, list, dict]:
    """Analyze a file and return results"""
    with open(filepath, 'r') as f:
        code = f.read()

    print(f"🔍 Analyzing {filepath}...")

    syntax_bugs = find_syntax_bugs(code)
    logic_bugs = find_logic_bugs(code)
    naming_bugs = find_naming_bugs(code)

    all_bugs = syntax_bugs + logic_bugs + naming_bugs
    quality = analyze_code_quality(code)

    if all_bugs:
        print(f"⚠️  Found {len(all_bugs)} issue(s)")
        for bug in all_bugs[:5]:
            print(f"  - Line {bug['line']}: {bug['description']} ({bug['severity']})")
    else:
        print(f"✅ No major issues found!")

    return {
        "filename": filepath,
        "quality": quality,
        "bugs_found": all_bugs,
        "summary": f"Analyzed {quality['lines_of_code']} lines with {len(all_bugs)} issues"
    }, all_bugs, quality

def main():
    """Main entry point"""
    files_to_analyze = ["Untitled-1.py"]

    all_results = {}

    for filepath in files_to_analyze:
        if Path(filepath).exists():
            analysis, bugs, quality = process_file(filepath)
            all_results[filepath] = analysis
        else:
            print(f"❌ File not found: {filepath}")

    # Save report
    with open("bug_analysis_report.json", "w") as f:
        json.dump(all_results, f, indent=2)

    print("\n📊 Analysis Report:")
    print("=" * 60)
    for filepath, result in all_results.items():
        print(f"\n{filepath}:")
        print(f"  Lines: {result['quality']['lines_of_code']}")
        print(f"  Quality: {result['quality']['overall_quality']}")
        print(f"  Issues: {len(result['bugs_found'])}")
        print(f"  Summary: {result['summary']}")

if __name__ == "__main__":
    main()
