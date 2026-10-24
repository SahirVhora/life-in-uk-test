# Life in the UK Test Practice

Free practice for the Life in the UK test, the test most people need to pass for indefinite leave to remain (ILR) or British citizenship.

**Live site:** https://sahirvhora.github.io/life-in-uk-test/

## What it does

- **Mock tests** that work like the real one: 24 questions, a 45 minute timer, 18 correct to pass. Questions are drawn across every topic in proportion. You can flag questions and jump around with the question map, and the answers stay hidden until you finish.
- **Topic practice** with an explanation after every answer, across five topics: values and principles, early history to 1714, history from 1714 to today, modern society, and government and law.
- **Missed questions.** Every wrong answer is saved and stays on the list until you answer it correctly.
- **Progress and study plan.** Add your test date and the site builds a day-by-day plan. Scores and accuracy by topic are kept in your browser only. Nothing is sent anywhere.
- **Key facts** sheet with the dates, people, festivals and numbers that come up most.

The bank has 391 questions, written from the official handbook, *Life in the United Kingdom: A Guide for New Residents* (3rd edition). They are not the official test questions, which are not published.

The handbook dates from 2013 and is out of date in a few places (the monarch, EU membership). The bank deliberately avoids those points, and a test enforces it.

## Run it locally

It is a static site with no build step and no dependencies.

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Tests

```bash
pip install pytest ruff
ruff check . && ruff format --check .
python -m pytest -q
```

The tests check the question bank (valid answers, two-answer wording, true or false format, no duplicates, no out-of-date topics, advertised counts) and the site (title and description length, canonical URLs, Open Graph and X cards, a 1200x630 preview image, structured data that matches the visible FAQ, sitemap, robots.txt, working links, self-hosted fonts and a strict content security policy). CI runs them on every push, and a separate workflow deploys the site to GitHub Pages.

## Project layout

```
index.html              the page, with all SEO metadata
assets/questions.js     the question bank (window.LIUK = {...})
assets/app.js           quiz engine, progress, study plan, key facts
assets/style.css        styles, light and dark themes
assets/fonts/           self-hosted Libre Caslon Text and Public Sans
scripts/                Pages build and preview image renderer
tests/                  question bank and site tests
```

## Adding a question

Add an entry to `assets/questions.js` with a new `id` in the topic's sequence, then run the tests. Questions with two correct answers must say "TWO" in the question. True or false questions start with "Is the following statement true or false?".

## Disclaimer

Not affiliated with the Home Office. Book the official test only through [GOV.UK](https://www.gov.uk/life-in-the-uk-test).

## Licence

Code and questions: MIT, see [LICENSE](LICENSE). Fonts: Libre Caslon Text and Public Sans, both under the SIL Open Font License 1.1.

Built by [Sahir Vhora](https://sahirvhora.github.io/).
