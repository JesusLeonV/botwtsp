FROM node:18-bookworm-slim

ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends     ca-certificates     curl     python3     python3-bcrypt     docker.io     chromium     chromium-common     chromium-sandbox     fonts-liberation     fonts-noto-color-emoji     libasound2     libatk-bridge2.0-0     libatk1.0-0     libcairo2     libcups2     libdbus-1-3     libdrm2     libexpat1     libfontconfig1     libgbm1     libglib2.0-0     libgtk-3-0     libnspr4     libnss3     libpango-1.0-0     libpangocairo-1.0-0     libu2f-udev     libx11-6     libx11-xcb1     libxcb1     libxcomposite1     libxcursor1     libxdamage1     libxext6     libxfixes3     libxi6     libxrandr2     libxrender1     libxss1     libxtst6     wget     xdg-utils     && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PYTHON_BIN=/usr/bin/python3
ENV AUTH_SCRIPT=/home/jesus/cloudsolutions/scripts/auth_cliente.py

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY index.js ./

EXPOSE 3000
CMD ["node", "index.js"]
