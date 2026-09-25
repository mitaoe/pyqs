"""Postgres connection helper. DATABASE_URL comes from the environment."""

import os

import psycopg2


def get_conn():
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL is not set — see .env.example")
    return psycopg2.connect(url)
