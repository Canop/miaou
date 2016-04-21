#
# Dockerfile for Miaou application
#

# Based on docker official node image
FROM node:5.10.1

# Install "nodemon" and "buster" globally
RUN npm install -g nodemon buster

# Setup workspace
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
