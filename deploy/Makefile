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

MAKE := make --no-print-directory

#
# Allows for resources to be loaded from outside the root location of
# the kustomize config file. Ensures that resource don't need to be
# copied around the file system.
#
# See https://kubectl.docs.kubernetes.io/faq/kustomize
#
KOPTIONS := --load-restrictor LoadRestrictionsNone

#
# Include the main camel-k Makefile containing
# basic common recipes like kustomize and vars
# like VERSION
#
include script/Makefile

#
# Vars that can be overridden by external env vars
#
DRY_RUN ?= false
NAMESPACE ?= hawtio-online

# Cluster on which to install [ openshift | k8s ]
CLUSTER ?= k8s
# The mode of installation [ cluster | namespace ]
MODE ?= namespace

# Uninstall all hawtio-onlineresources: [true|false]
UNINSTALL_ALL ?=false


PLACEHOLDER := placeholder
YAML := yaml

#
# Macro for editing kustomization to define
# the image reference
#
# Parameter: directory of the kustomization.yaml
#
define set-kustomize-image
	$(if $(filter $(IMAGE_NAME),$(CUSTOM_IMAGE):$(CUSTOM_VERSION)),,\
		@cd $(1) || exit 1 && \
			$(KUSTOMIZE) edit set image $(IMAGE_NAME)=$(CUSTOM_IMAGE):$(CUSTOM_VERSION))
endef

#
# Macro for editing kustomization to define
# the namespace
#
# Parameter: directory of the kustomization.yaml
#
define set-kustomize-namespace
	@cd $(1) || exit 1 && \
		$(KUSTOMIZE) edit set namespace $(NAMESPACE)
endef

#
# Add or remove a patch on a kustomization.yaml
# targetting a kind of resource
#
# Parameters:
# * directory of the kustomization.yaml
# * [add, remove]
# * path of patch
# * kind of resources, eg. Deployment, Role
#
define add-remove-kind-patch
	@cd $(1) || exit 1 && \
		$(KUSTOMIZE) edit $(2) patch --path $(3) --kind $(4) &> /dev/null
endef

.PHONY: check_admin kubectl kustomize install

#
# Checks if the cluster user has the necessary privileges to be a cluster-admin
# In this case if the user can list the CRDs then probably a cluster-admin
#
check-admin: kubectl
	@output=$$(kubectl get crd 2>&1) || (echo "****" && echo "**** ERROR: Cannot continue as user is not a Cluster-Admin ****" && echo "****"; exit 1)

#---
#
#@ install
#
#== Install the deployment into the cluster
#
#=== Calls kustomize
#=== Calls kubectl
#
#* PARAMETERS:
#** CLUSTER:        Set the cluster type to install on [ openshift | k8s ]
#** MODE:           Set the mode of installation [ cluster | namespace ]
#** NAMESPACE:      Set the namespace for the resources
#** CUSTOM_IMAGE:   Set a custom image to install from
#** CUSTOM_VERSION: Set a custom version to install from
#** DRY_RUN:      Print the resources to be applied instead of applying them [ true | false ]
#
#---
install: kustomize kubectl
# Set the namespace in the setup kustomization yaml
	@$(call set-kustomize-namespace, $(CLUSTER)/$(MODE))
# Set the image reference of the kustomization
	@$(call set-kustomize-image,$(CLUSTER)/$(MODE))
#
# Build the resources
# Either apply to the cluster or output to CLI
#
ifeq ($(DRY_RUN), false)
	@$(KUSTOMIZE) build $(KOPTIONS) $(CLUSTER)/$(MODE) | kubectl apply -f -
else
	@$(KUSTOMIZE) build $(KOPTIONS) $(CLUSTER)/$(MODE)
endif

.PHONY: uninstall

#---
#
#@ uninstall
#
#== Uninstall the resources previously installed.
#
#=== Cluster-admin privileges are required.
#
#* PARAMETERS:
#** CLUSTER:   Set the cluster type to install on [ openshift | k8s ]
#** MODE:      Set the mode of installation [ cluster | namespace ]
#** NAMESPACE:     Set the namespace to uninstall the resources from
#** UNINSTALL_ALL: Uninstall all Camel K resources including crds and cluster roles installed by setup-cluster [true|false]
#** DRY_RUN:       Print the resources to be applied instead of applying them [true|false]
#
#---
uninstall: kubectl kustomize
# Set the namespace in the all target kustomization yaml
	@$(call set-kustomize-namespace, $(CLUSTER)/$(MODE))
ifeq ($(DRY_RUN), false)
	@$(KUSTOMIZE) build $(KOPTIONS) $(CLUSTER)/$(MODE) | kubectl delete --ignore-not-found=true -f -
else
	@$(KUSTOMIZE) build $(KOPTIONS) $(CLUSTER)/$(MODE) | kubectl delete --dry-run=client -f -
endif

.DEFAULT_GOAL := help
.PHONY: help
help: ## Show this help screen.
	@awk 'BEGIN { printf "\nUsage: make \033[31m<PARAM1=val1 PARAM2=val2>\033[0m \033[36m<target>\033[0m\n"; printf "\nAvailable targets are:\n" } /^#@/ { printf "\033[36m%-15s\033[0m", $$2; subdesc=0; next } /^#===/ { printf "%-14s \033[32m%s\033[0m\n", " ", substr($$0, 5); subdesc=1; next } /^#==/ { printf "\033[0m%s\033[0m\n\n", substr($$0, 4); next } /^#\*\*/ { printf "%-14s \033[31m%s\033[0m\n", " ", substr($$0, 4); next } /^#\*/ && (subdesc == 1) { printf "\n"; next } /^#\-\-\-/ { printf "\n"; next }' $(MAKEFILE_LIST)
