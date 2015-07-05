#
# Dockerfile for Miaou development
#



# Based on docker official ubuntu LTS image
FROM ubuntu:14.04



# Define Dockerfile maintainer
MAINTAINER Oliver THEBAULT <contact@oliver-thebault.com>



# Update/upgrade apt-get
RUN \
	apt-get update && \
	apt-get -y upgrade



# Install Ubuntu miscellaneous packages
RUN \
	apt-get install -y \
		make curl apt-transport-https



# Install Ruby and SASS
RUN \
	apt-get install -y \
		ruby ruby-dev ruby-bundler && \
	gem install \
		sass



# Install IOJS/NPM and globally install "nodemon", "uglify" and "buster"
RUN \
	echo 'deb https://deb.nodesource.com/iojs_2.x trusty main' > /etc/apt/sources.list.d/nodesource.list && \
	curl -s https://deb.nodesource.com/gpgkey/nodesource.gpg.key | apt-key add - && \
	apt-get update && \
	apt-get install -y \
		iojs && \
	npm install -g \
		nodemon uglify-js buster



# Clean apt-get (it's worth nothing)
RUN \
	apt-get clean && \
	rm -rf /var/lib/apt/lists/*



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
