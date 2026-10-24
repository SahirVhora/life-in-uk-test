"""Integrity tests for the question bank, so a bad edit cannot ship a wrong or broken question."""

import re
from collections import Counter

import pytest
from conftest import ROOT, load_bank

BANK = load_bank()
QUESTIONS = BANK["questions"]
TOPICS = BANK["topics"]


def test_bank_has_every_topic_and_enough_questions():
    assert set(TOPICS) == {"V", "H1", "H2", "S", "G"}
    counts = Counter(q["topic"] for q in QUESTIONS)
    assert set(counts) == set(TOPICS)
    assert len(QUESTIONS) >= 150
    # A 24-question mock draws in proportion, so every topic needs enough depth.
    assert min(counts.values()) >= 5


def test_ids_unique_and_well_formed():
    ids = [q["id"] for q in QUESTIONS]
    assert len(ids) == len(set(ids))
    for q in QUESTIONS:
        assert re.fullmatch(r"(v|h1|h2|s|g)-\d{3}", q["id"]), q["id"]
        assert q["id"].split("-")[0] == q["topic"].lower()


def test_no_duplicate_questions():
    texts = Counter(q["question"].strip().lower() for q in QUESTIONS)
    dupes = [t for t, n in texts.items() if n > 1]
    assert not dupes, dupes


@pytest.mark.parametrize("q", QUESTIONS, ids=lambda q: q["id"])
def test_question_shape(q):
    assert q["question"].strip() and q["explanation"].strip()
    opts = q["options"]
    assert 2 <= len(opts) <= 4
    assert len({o.lower() for o in opts}) == len(opts), "options must be distinct"
    ans = q["answer"]
    assert ans and len(set(ans)) == len(ans)
    assert all(0 <= a < len(opts) for a in ans)


@pytest.mark.parametrize("q", QUESTIONS, ids=lambda q: q["id"])
def test_two_answer_wording_matches_answers(q):
    multi = len(q["answer"]) == 2
    assert multi == ("TWO" in q["question"]), "questions with two answers must say TWO, and only those"
    if multi:
        assert len(q["options"]) == 4


@pytest.mark.parametrize("q", QUESTIONS, ids=lambda q: q["id"])
def test_true_false_questions(q):
    tf = q["question"].startswith("Is the following statement true or false?")
    assert tf == (q["options"] == ["True", "False"])
    if tf:
        assert len(q["answer"]) == 1


# The handbook (2013) is out of date on these points. The bank avoids them so a learner
# never sees a question where the handbook answer and today's position differ.
OUTDATED = ["european union", " eu ", "queen elizabeth ii", "prince charles", "member states", "108 members"]


@pytest.mark.parametrize("q", QUESTIONS, ids=lambda q: q["id"])
def test_avoids_points_where_handbook_is_outdated(q):
    text = " " + " ".join([q["question"], *q["options"], q["explanation"]]).lower() + " "
    hits = [w for w in OUTDATED if w in text]
    assert not hits, hits


def test_house_style_no_em_dashes():
    for rel in ("assets/questions.js", "assets/app.js", "index.html", "README.md"):
        assert "—" not in (ROOT / rel).read_text(encoding="utf-8"), rel


def test_advertised_question_count_is_true():
    n = len(QUESTIONS)
    index = (ROOT / "index.html").read_text(encoding="utf-8")
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    assert f"{n} questions" in index
    assert f"{n} questions" in readme
    for other in set(re.findall(r"(\d+) questions written", index)):
        assert int(other) == n
