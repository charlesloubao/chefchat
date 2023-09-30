FROM postgres:bullseye

# Install git
RUN apt-get update \
    && apt-get install build-essential postgresql-server-dev-16 git -y

# Install the plugin
WORKDIR /tmp
RUN git clone --branch v0.5.0 https://github.com/pgvector/pgvector.git \
    && cd pgvector \
    && make \
    && make install