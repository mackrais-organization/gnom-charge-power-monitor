FROM python:3.12-bookworm@sha256:581429e3df12d76e6af4be5ab7d0e7fc2013eb57dc23d2de691411c8efdbb970

COPY requirements.lock /tmp/requirements.lock

RUN PIP_ROOT_USER_ACTION=ignore pip install --no-cache-dir --require-hashes \
        --requirement /tmp/requirements.lock \
    && pip check

ENTRYPOINT ["shexli"]
