FROM node:20-bookworm-slim

ARG LB_VERSION=4.33.0
ARG MYSQL_VERSION=9.1.0

RUN apt-get update \
  && apt-get install -y --no-install-recommends openjdk-17-jre-headless curl unzip ca-certificates \
  && curl -fsSL -o /tmp/lb.zip \
    "https://github.com/liquibase/liquibase/releases/download/v${LB_VERSION}/liquibase-${LB_VERSION}.zip" \
  && unzip -q /tmp/lb.zip -d /opt/liquibase \
  && chmod +x /opt/liquibase/liquibase \
  && mkdir -p /opt/liquibase/lib \
  && curl -fsSL -o /opt/liquibase/lib/mysql.jar \
    "https://repo1.maven.org/maven2/com/mysql/mysql-connector-j/${MYSQL_VERSION}/mysql-connector-j-${MYSQL_VERSION}.jar" \
  && rm -rf /var/lib/apt/lists/* /tmp/lb.zip

ENV PATH="/opt/liquibase:${PATH}" \
    LIQUIBASE_PATH=/opt/liquibase/liquibase

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 4000
CMD ["node", "server.js"]
