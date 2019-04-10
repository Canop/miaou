#
# Dockerfile for Miaou application
#
# The docker solution isn't really maintained. Ping us on miaou.dystroy.org
#  if you need it and we'll resurect it

# Based on docker official node image
FROM node

# Install "nodemon" and "buster" globally
USER node
RUN mkdir ~/.npm-global
ENV NPM_CONFIG_PREFIX ~/.npm-global

# Setup workspace
USER root
RUN mkdir -p /var/www/miaou
WORKDIR /var/www/miaou

# NPM install (this is done before copying the whole application, in order to be cached)
COPY package.json /var/www/miaou/
RUN npm install

# Copy and build application
COPY . /var/www/miaou/
RUN npm run build

# Define exposable ports
EXPOSE 8204

# Define default command
CMD ["node", "--use_strict", "main.js"]
