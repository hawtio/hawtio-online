# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements.  See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
# the License.  You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

#
# Use bash explicitly in this Makefile to avoid unexpected platform
# incompatibilities among Linux distros.
#
SHELL := /bin/bash

VERSION ?= 2.0.0-SNAPSHOT
LAST_RELEASED_IMAGE_NAME := hawtio/online
LAST_RELEASED_VERSION ?= 1.12.0
CONTROLLER_GEN_VERSION := v0.6.1
OPERATOR_SDK_VERSION := v1.26.1
KUSTOMIZE_VERSION := v4.5.4
OPM_VERSION := v1.24.0
IMAGE_NAME ?= hawtio/online

#
# Situations when user wants to override
# the image name and version
# - used in kustomize install
# - used in making bundle
# - need to preserve original image and version as used in other files
#
CUSTOM_IMAGE ?= $(IMAGE_NAME)
CUSTOM_VERSION ?= $(VERSION)

METADATA_IMAGE_NAME := $(CUSTOM_IMAGE)-metadata
BUNDLE_IMAGE_NAME ?= $(CUSTOM_IMAGE)-bundle
RELEASE_GIT_REMOTE := origin
GIT_COMMIT := $(shell if [ -d .git ]; then git rev-list -1 HEAD; else echo "$(CUSTOM_VERSION)"; fi)
LINT_GOGC := 10
LINT_DEADLINE := 10m


# olm bundle vars
MANAGER := config/manager
MANIFESTS := config/manifests
CHANNELS ?= $(shell v=$(OPERATOR_VERSION) && echo "stable-$${v%\.[0-9]}"),candidate,latest
DEFAULT_CHANNEL ?= $(shell v=$(OPERATOR_VERSION) && echo "stable-$${v%\.[0-9]}")
PACKAGE := hawtio
CSV_VERSION := $(CUSTOM_VERSION)
CSV_NAME := $(PACKAGE).v$(CSV_VERSION)
# Final CSV name that replaces the name required by the operator-sdk
# Has to be replaced after the bundle has been generated
CSV_PRODUCTION_NAME := $(LAST_RELEASED_IMAGE_NAME).v$(CSV_VERSION)
CSV_DISPLAY_NAME := Hawtio Online
CSV_SUPPORT := Hawtio
CSV_REPLACES := $(LAST_RELEASED_IMAGE_NAME).v$(LAST_RELEASED_VERSION)
CSV_FILENAME := $(PACKAGE).clusterserviceversion.yaml
CSV_PATH := $(MANIFESTS)/bases/$(CSV_FILENAME)
CSV_PRODUCTION_PATH := bundle/manifests/$(CSV_FILENAME)

# Test Bundle Index
BUNDLE_INDEX := quay.io/operatorhubio/catalog:latest
INDEX_DIR := index
OPM := opm

define LICENSE_HEADER
Licensed to the Apache Software Foundation (ASF) under one or more
contributor license agreements.  See the NOTICE file distributed with
this work for additional information regarding copyright ownership.
The ASF licenses this file to You under the Apache License, Version 2.0
(the "License"); you may not use this file except in compliance with
the License.  You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
endef

export LICENSE_HEADER
default: build

kubectl:
ifeq (, $(shell command -v kubectl 2> /dev/null))
	$(error "No kubectl found in PATH. Please install and re-run")
endif

kustomize:
ifeq (, $(shell command -v kustomize 2> /dev/null))
	$(error "No kustomize found in PATH. Please install and re-run")
else
KUSTOMIZE=$(shell command -v kustomize 2> /dev/null)
endif

yarn:
ifeq (, $(shell command -v yarn 2> /dev/null))
	$(error "No yarn found in PATH. Please install and re-run")
else
YARN=$(shell command -v yarn 2> /dev/null)
endif

setup: yarn
	yarn install

build: setup
	@echo "####### Building hawtio/online ..."
	yarn build:online

clean:
	rm -rf $(PACKAGES)/$(ONLINE_SHELL)/build

lint: setup
	yarn lint

lint-fix: setup
	yarn lint:fix

format: setup
	yarn format:check

format-fix: setup
	yarn format:fix

check-licenses:
	./script/check_licenses.sh

# TODO
# Pod keep crashing on OS
# 10.217.0.1 - - [19/Sep/2023:19:53:24 +0000] "GET /online HTTP/1.1" 500 177 "-" "kube-probe/1.26" "-"
# 2023/09/19 19:53:29 [error] 17#17: *13 rewrite or internal redirection cycle while internally redirecting to "/online/index.html", client: 10.217.0.1, server: localhost, request: "GET /online HTTP/1.1", host: "10.217.1.238:8443"
# 10.217.0.1 - - [19/Sep/2023:19:53:29 +0000] "GET /online HTTP/1.1" 500 177 "-" "kube-probe/1.26" "-"
# 2023/09/19 19:53:34 [error] 17#17: *14 rewrite or internal redirection cycle while internally redirecting to "/online/index.html", client: 10.217.0.1, server: localhost, request: "GET /online HTTP/1.1", host: "10.217.1.238:8443"
# 10.217.0.1 - - [19/Sep/2023:19:53:34 +0000] "GET /online HTTP/1.1" 500 177 "-" "kube-probe/1.26" "-"
# 2023/09/19 19:53:39 [error] 17#17: *15 rewrite or internal redirection cycle while internally redirecting to "/online/index.html", client: 10.217.0.1, server: localhost, request: "GET /online HTTP/1.1", host: "10.217.1.238:8443"
# 10.217.0.1 - - [19/Sep/2023:19:53:39 +0000] "GET /online HTTP/1.1" 500 177 "-" "kube-probe/1.26" "-"


image:
	@echo "####### Building Hawtio Online container image..."
	docker build -t $(CUSTOM_IMAGE):$(CUSTOM_VERSION) -f Dockerfile .

image-push: image
	docker push $(CUSTOM_IMAGE):$(CUSTOM_VERSION)

get-image:
	@echo $(CUSTOM_IMAGE)

get-version:
	@echo $(CUSTOM_VERSION)

set-version:
	./script/set_version.sh $(CUSTOM_VERSION) $(CUSTOM_IMAGE)

git-tag:
	./script/git_tag.sh $(CUSTOM_VERSION) $(RELEASE_GIT_REMOTE)

.PHONY: kubectl kustomize yarn setup build clean lint lint-fix format format-fix check-licenses image image-push get-image get-version set-version git-tag
