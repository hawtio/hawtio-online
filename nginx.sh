#!/bin/sh

./config.sh > config.js

nginx -g 'daemon off;'