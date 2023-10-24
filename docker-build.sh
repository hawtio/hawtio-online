#!/bin/bash

TAG_REG="quay.io/phantomjinx"
TAG_NAME="hawtio-online"
TAG_VERSION="2.x"
TAG_DATE=$(date '+%Y%m%d_%H%M%S')

CUSTOM_IMAGE="${TAG_REG}/${TAG_NAME}" \
CUSTOM_VERSION="${TAG_VERSION}.${TAG_DATE}" \
make image-push
