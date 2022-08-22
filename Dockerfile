FROM node:16-slim
EXPOSE 80

WORKDIR /usr/src
COPY .npmrc /root/
COPY . /usr/src
RUN npm install --no-optional --production
RUN rm -f /root/.npmrc && rm -f /usr/src/.npmrc

CMD ["npm", "run", "start"]
