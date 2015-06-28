#
# Dockerfile for Miaou development
#



# Based on docker official ubuntu LTS image
FROM ubuntu:14.04



# Define Dockerfile maintainer
MAINTAINER Oliver THEBAULT <contact@oliver-thebault.com>



# Install Ubuntu miscellaneous packages
RUN \
	sed -i 's/# \(.*multiverse$\)/\1/g' /etc/apt/sources.list && \
	apt-get update && \
	apt-get -y upgrade && \
	apt-get install -y \
		build-essential \
		software-properties-common \
		curl wget unzip xz-utils \
		git nano vim man htop && \
	apt-get clean



# Install Python (used to build NPM dependencies)
RUN \
	apt-get update && \
	apt-get install -y python python-dev python-pip python-virtualenv && \
	apt-get clean



# Install Ruby and SASS
RUN \
	apt-get update && \
	apt-get install -y ruby ruby-dev ruby-bundler && \
	apt-get clean && \
	gem install sass



# Install IOJS/NPM and globally install "nodemon", "uglify" and "buster"
ENV IOJS_VERSION 2.3.1
RUN curl https://iojs.org/dist/v$IOJS_VERSION/iojs-v$IOJS_VERSION-linux-x64.tar.xz | tar -xJC /usr/src
ENV PATH /usr/src/iojs-v$IOJS_VERSION-linux-x64/bin:$PATH
RUN \
	npm install -g nodemon uglify-js buster



# Define exposable ports
EXPOSE 8204



# Define mountable directories
VOLUME ["/var/www/html"]



# Set the script to use as entry point for the container
COPY docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]



# Define default working directory
WORKDIR /var/www/html



# Define default command
CMD ["/bin/bash"]
