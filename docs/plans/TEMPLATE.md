# Plan: [Feature Name]

**Date:** YYYY-MM-DD
**Status:** Draft / In Progress / Done
**Layer:** Python tools / Router / Prompts / Warmly UI / GitHub Actions / Multi-layer

---

## Goal

[One sentence: what does this plan accomplish?]

---

## Background

[Why are we building this? Link to the design doc if one exists: `docs/plans/YYYY-MM-DD-<topic>-design.md`]

---

## Architecture

[2-3 sentences: approach, patterns used, why this way and not another]

---

## Blocks

### Block 1: [Name]

**Success Criteria:**
- [ ] [Measurable outcome]
- [ ] All relevant tests pass

#### Chunk 1.1 — [Name]

**Files:**
- Create: `path/to/new.py`
- Modify: `path/to/existing.py:L10-20`

**Step 1: Write failing test**
```python
# tests/test_<module>.py
def test_<behavior>():
    # Arrange
    # Act
    # Assert
    assert ...
```

**Step 2: Verify failure**
```bash
python -m pytest tests/test_<module>.py::test_<behavior> -v
# Expected: FAILED — <reason>
```

**Step 3: Implement minimal code**
```python
# path/to/new.py
def <function>():
    ...
```

**Step 4: Verify pass**
```bash
python -m pytest tests/test_<module>.py::test_<behavior> -v
# Expected: PASSED
python -m pytest tests/ -v
# Expected: 138+ tests, 0 failures
```

**Step 5: Commit**
```bash
git add path/to/new.py tests/test_<module>.py
git commit -m "[Add] [scope]: <one-line description>"
```

---

### Block 2: [Name] (if applicable)

[Repeat structure above]

---

## Technical Debt Strategy

[List any known shortcuts or hacks being introduced. These go into docs/BUGS.md if not addressed.]

---

## Success Criteria

- [ ] All 138+ tests pass with no regressions
- [ ] Feature works end-to-end (describe the manual verification step)
- [ ] Warmly build passes (if UI changed): `cd warmly && node_modules/.bin/next build`
- [ ] No live API calls in tests (all mocked)
- [ ] docs/BUGS.md updated with any new debt items

---

## Notes

[Decisions, trade-offs, open questions. Link to `.agent/decisions.log` entries if relevant.]
