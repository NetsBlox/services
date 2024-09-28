FROM node:18-bookworm

# Install updated C++ std lib plus a few things required for NodeHun, canvas/chart, docs building, etc.
RUN echo "deb http://deb.debian.org/debian testing main" >> /etc/apt/sources.list && apt-get update
RUN apt-get install -y build-essential libstdc++-11-dev gnuplot libcairo2-dev libpango1.0-dev libsdl-pango-dev libjpeg-dev libgif-dev librsvg2-dev python3-sphinx python3-sphinx-rtd-theme

RUN ls /usr/include/cairo

WORKDIR /netsblox
ADD . .
RUN apt-get clean && rm -rf /tmp/* && npm install

CMD ["npm", "start"]
