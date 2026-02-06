from mcp.server.fastmcp import FastMCP
import subprocess
import os
import json
import glob
mcp = FastMCP(
    name="local-tools",
    instructions="Local MCP server for shell + file + quick data inspection (CSV/Excel/NPY)"
)

# -------------------------
# Core utilities
# -------------------------
@mcp.tool()
def run_shell(command: str) -> str:
    """Run a SAFE shell command and return output."""
    allowed_prefixes = (
        "python ", "py ",
        "pip ", "pytest", "ruff", "black",
        "git ", "npm ", "pnpm ", "yarn ",
        "dir", "ls", "cat", "type",
    )
    cmd = command.strip()
    if not cmd.startswith(allowed_prefixes):
        return "Blocked: command not in allowlist."

    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    return (result.stdout or "") + (result.stderr or "")

@mcp.tool()
def read_file(path: str) -> str:
    """Read a UTF-8 text file and return its contents."""
    with open(path, "r", encoding="utf-8") as f:
        return f.read()

@mcp.tool()
def list_dir(path: str = ".") -> str:
    """List files/folders in a directory (non-recursive)."""
    items = os.listdir(path)
    items.sort()
    return "\n".join(items)

@mcp.tool()
def read_json(path: str) -> str:
    """Read a JSON file and return pretty-printed JSON."""
    with open(path, "r", encoding="utf-8") as f:
        obj = json.load(f)
    return json.dumps(obj, ensure_ascii=False, indent=2)

@mcp.tool()
def write_json(path: str, content_json: str) -> str:
    """Write JSON content to a file. content_json must be a JSON string."""
    obj = json.loads(content_json)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
    return f"Wrote JSON to {path}"

# -------------------------
# Data inspection (ML/DL)
# -------------------------
@mcp.tool()
def read_csv_head(path: str, n: int = 5) -> str:
    """Read first n rows of a CSV (pandas) and return as text table."""
    import pandas as pd
    df = pd.read_csv(path)
    return df.head(n).to_string(index=False)

@mcp.tool()
def read_excel_sheets(path: str) -> str:
    """List sheet names in an Excel file."""
    import pandas as pd
    xls = pd.ExcelFile(path)
    return "\n".join(xls.sheet_names)

@mcp.tool()
def read_excel_head(path: str, sheet_name: str, n: int = 5) -> str:
    """Read first n rows of an Excel sheet and return as text table."""
    import pandas as pd
    df = pd.read_excel(path, sheet_name=sheet_name)
    return df.head(n).to_string(index=False)

@mcp.tool()
def numpy_load_shape(path: str) -> str:
    """Load a .npy file and return shape/dtype (does not print full data)."""
    import numpy as np
    arr = np.load(path, allow_pickle=False)
    return f"shape={arr.shape}, dtype={arr.dtype}"
@mcp.tool()
def find_files(root: str, pattern: str) -> str:
    """Find files by glob pattern under root (e.g., **/*.py)."""
    path_pattern = os.path.join(root, pattern)
    matches = glob.glob(path_pattern, recursive=True)
    matches.sort()
    return "\n".join(matches[:200])  # limit

@mcp.tool()
def grep_text(path: str, keyword: str) -> str:
    """Search keyword in a text file and return matching lines (limited)."""
    out = []
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        for i, line in enumerate(f, 1):
            if keyword in line:
                out.append(f"{i}: {line.rstrip()}")
            if len(out) >= 50:
                break
    return "\n".join(out) if out else "No matches."

@mcp.tool()
def read_text_head(path: str, n_lines: int = 60) -> str:
    """Read first N lines of a text file."""
    lines = []
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        for _ in range(n_lines):
            line = f.readline()
            if not line:
                break
            lines.append(line.rstrip("\n"))
    return "\n".join(lines)

@mcp.tool()
def git_status(repo_path: str = ".") -> str:
    """Run git status in given repo path."""
    cmd = f'cd "{repo_path}" && git status'
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    return (result.stdout or "") + (result.stderr or "")
if __name__ == "__main__":
    mcp.run()
