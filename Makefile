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

VERSION := 2.3.0
LAST_RELEASED_IMAGE_NAME := hawtio/online
LAST_RELEASED_VERSION ?= 2.2.0
CONTROLLER_GEN_VERSION := v0.6.1
OPERATOR_SDK_VERSION := v1.26.1
KUSTOMIZE_VERSION := v4.5.4
OPM_VERSION := v1.24.0
IMAGE_NAME ?= quay.io/hawtio/online
GATEWAY_IMAGE_NAME ?= quay.io/hawtio/online-gateway

# Replace SNAPSHOT with the current timestamp
DATETIMESTAMP=$(shell date -u '+%Y%m%d-%H%M%S')
VERSION := $(subst -SNAPSHOT,-$(DATETIMESTAMP),$(VERSION))

GATEWAY_DOCKERFILE=Dockerfile-gateway
NGINX_DOCKERFILE=Dockerfile-nginx

#
# Situations when user wants to override
# the image name and version
# - used in kustomize install
# - need to preserve original image and version as used in other files
#
CUSTOM_IMAGE ?= $(IMAGE_NAME)
CUSTOM_GATEWAY_IMAGE ?= $(GATEWAY_IMAGE_NAME)
CUSTOM_VERSION ?= $(VERSION)
CUSTOM_GATEWAY_VERSION ?= $(VERSION)

RELEASE_GIT_REMOTE := origin
GIT_COMMIT := $(shell if [ -d .git ]; then git rev-list -1 HEAD; else echo "$(CUSTOM_VERSION)"; fi)
LINT_GOGC := 10
LINT_DEADLINE := 10m

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

container-builder:
ifeq (, $(shell command -v podman 2> /dev/null))
ifeq (, $(shell command -v docker 2> /dev/null))
	$(error "No podman or docker found in PATH. Please install and re-run")
else
CONTAINER_BUILDER=$(shell command -v docker 2> /dev/null)
endif
else
CONTAINER_BUILDER=$(shell command -v podman 2> /dev/null)
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

image: container-builder
	@echo "####### Building Hawtio Online container image..."
	$(CONTAINER_BUILDER) build -t $(CUSTOM_IMAGE):$(CUSTOM_VERSION) -f Dockerfile-nginx .

image-push: image
	$(CONTAINER_BUILDER) push $(CUSTOM_IMAGE):$(CUSTOM_VERSION)

image-gateway: container-builder
	@echo "####### Building Hawtio Online Gateway container image..."
	$(CONTAINER_BUILDER) build -t $(CUSTOM_GATEWAY_IMAGE):$(CUSTOM_GATEWAY_VERSION) -f Dockerfile-gateway .

image-gateway-push: image-gateway
	$(CONTAINER_BUILDER) push $(CUSTOM_GATEWAY_IMAGE):$(CUSTOM_GATEWAY_VERSION)

get-image:
	@echo $(CUSTOM_IMAGE)

get-version:
	@echo $(CUSTOM_VERSION)

set-version:
	./script/set_version.sh $(CUSTOM_VERSION) $(CUSTOM_IMAGE)

git-tag:
	./script/git_tag.sh $(CUSTOM_VERSION) $(RELEASE_GIT_REMOTE)

.PHONY: kubectl kustomize yarn setup build clean lint lint-fix format format-fix check-licenses image image-push get-image get-version set-version git-tag
