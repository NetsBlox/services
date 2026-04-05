FROM node:18-bookworm

RUN apt-get update

# Install C++ std lib plus a few things required for NodeHun, canvas/chart, docs building, etc.
RUN apt-get install -y \
    build-essential \
    libstdc++-12-dev \
    gnuplot \
    libcairo2-dev \
    libpango1.0-dev \
    libsdl-pango-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    python3-sphinx \
    python3-sphinx-rtd-theme

WORKDIR /netsblox
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm install 
COPY . .
CMD ["npm", "start"]
