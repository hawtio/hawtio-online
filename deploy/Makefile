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
CLUSTER_TYPE ?= k8s
# The mode of installation [ cluster | namespace ]
MODE ?= namespace
# Use configmap as hawtconfig file
HAWTCONFIG ?= true
# The URL to use for access to the openshift console
OS_CONSOLE_URL ?=

# Uninstall all hawtio-onlineresources: [true|false]
UNINSTALL_ALL ?=false

BASE := base
PATCHES := patches
PLACEHOLDER := placeholder

OS_CONSOLE_URL_PATCH := $(PATCHES)/patch-os-console-url.yml
HAWTCONFIG_PATCH := $(PATCHES)/patch-hawtconfig-configmap.yml

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
# the image reference
#
# Parameter: directory of the kustomization.yaml
#
define set-kustomize-gateway-image
	$(if $(filter $(GATEWAY_IMAGE_NAME),$(CUSTOM_GATEWAY_IMAGE):$(CUSTOM_VERSION)),,\
		@cd $(1) || exit 1 && \
			$(KUSTOMIZE) edit set image $(GATEWAY_IMAGE_NAME)=$(CUSTOM_GATEWAY_IMAGE):$(CUSTOM_VERSION))
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

#
# Macro for adding / removing the prometheus resources for monitoring
#
define add-remove-hawtconfig-configmap
	cd $(1) || exit 1 && \
		$(KUSTOMIZE) edit $(2) resource configmap-hawtio-online.yml &> /dev/null
endef

.PHONY: check_admin kubectl kustomize install generate-proxying

#
# Checks if the cluster user has the necessary privileges to be a cluster-admin
# In this case if the user can list the CRDs then probably a cluster-admin
#
check-admin: kubectl
	@output=$$(kubectl get crd 2>&1) || (echo "****" && echo "**** ERROR: Cannot continue as user is not a Cluster-Admin ****" && echo "****"; exit 1)

#
# Handle if console url has been specified for openshift
#
.openshift-console-url:
ifeq ($(OS_CONSOLE_URL),)
	@$(call add-remove-kind-patch,$(CLUSTER_TYPE)/$(MODE),remove,../../$(OS_CONSOLE_URL_PATCH),Deployment)
else
	@sed -i 's~.*value:.*~              value: "$(OS_CONSOLE_URL)"~' $(OS_CONSOLE_URL_PATCH)
	@$(call add-remove-kind-patch,$(CLUSTER_TYPE)/$(MODE),add,../../$(OS_CONSOLE_URL_PATCH),Deployment)
endif

#
# Handle whether to use hawtconfig configmap
#
.hawtconfig:
ifeq ($(HAWTCONFIG), true)
	@$(call add-remove-kind-patch,$(BASE),add,../$(HAWTCONFIG_PATCH),Deployment)
	@$(call add-remove-hawtconfig-configmap,$(BASE),add)
else
	@$(call add-remove-kind-patch,$(BASE),remove,../$(HAWTCONFIG_PATCH),Deployment)
	@$(call add-remove-hawtconfig-configmap,$(BASE),remove)
endif

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
#** CLUSTER_TYPE:          Set the cluster type to install on [ openshift | k8s ]
#** MODE:                  Set the mode of installation [ cluster | namespace ]
#** NAMESPACE:             Set the namespace for the resources
#** HAWTCONFIG:            Set whether to use configmap as hawtconfig.json [ true | false ] (true by default)
#** CUSTOM_IMAGE:          Set a custom image to install from
#** CUSTOM_GATEWAY_IMAGE:  Set a custom gateway image to install from
#** CUSTOM_VERSION:        Set a custom version to install from
#** OS_CONSOLE_URL:        Set the location URL of the openshift console (only used in 'openshift' mode)
#** DRY_RUN:             Print the resources to be applied instead of applying them [ true | false ]
#
#---
install: kustomize kubectl
# Set the namespace in the setup kustomization yaml
	@$(call set-kustomize-namespace, $(CLUSTER_TYPE)/$(MODE))
# Set the image reference of the kustomization
	@$(call set-kustomize-image,$(CLUSTER_TYPE)/$(MODE))
# Set the gateway image reference of the kustomization
	@$(call set-kustomize-gateway-image,$(CLUSTER_TYPE)/$(MODE))
# Configure use of hawtconfig configmap
	@$(MAKE) -s .hawtconfig
# Set the console url on openshift, if specified
ifeq ($(CLUSTER_TYPE), openshift)
	@$(MAKE) -s .openshift-console-url
endif
# Add the tls proxying on openshift, if specified
ifeq ($(CLUSTER_TYPE), openshift)
	@$(MAKE) -s generate-proxying
endif
# Add the tls serving on k8s, if specified
ifeq ($(CLUSTER_TYPE), k8s)
	@$(MAKE) -s generate-serving
endif
#
# Build the resources
# Either apply to the cluster or output to CLI
# Post-processes any remaining 'placeholder'
# that may remain, eg. in rolebindings
#
ifeq ($(DRY_RUN), false)
	@$(KUSTOMIZE) build $(KOPTIONS) $(CLUSTER_TYPE)/$(MODE) | \
		sed 's/$(PLACEHOLDER)/$(NAMESPACE)/' | \
		kubectl apply -f -
# Add the oauth client on openshift, if specified
ifeq ($(CLUSTER_TYPE), openshift)
ifeq ($(MODE), cluster)
	@$(MAKE) -s cluster-auth-client
endif
endif
else
	@$(KUSTOMIZE) build $(KOPTIONS) $(CLUSTER_TYPE)/$(MODE) | \
		sed 's/$(PLACEHOLDER)/$(NAMESPACE)/'
endif

#---
#
#@ generate-proxying
#
#== Generate a client certificate and TLS secret for Hawtio proxying on Openshift
#
#=== Calls check-admin
#
#* PARAMETERS:
#** CLUSTER_TYPE:          Set the cluster type to install on [ openshift | k8s ] - must be openshift as not applicable to kubernetes
#** NAMESPACE:             Set the namespace for the secret
#
#---
generate-proxying: check-admin
ifneq ($(CLUSTER_TYPE), openshift)
	$(error "Only applicable to cluster-type of Openshift")
endif
	NAMESPACE=$(NAMESPACE) ./script/generate-proxying.sh

#---
#
#@ generate-serving
#
#== Generate a client certificate and TLS secret for Hawtio on kubernetes
#
#=== Calls check-admin
#
#* PARAMETERS:
#** CLUSTER_TYPE:          Set the cluster type to install on [ openshift | k8s ] - must be kubernetes as not applicable to openshift
#** NAMESPACE:             Set the namespace for the secret
#
#---
generate-serving: check-admin
ifneq ($(CLUSTER_TYPE), k8s)
	$(error "Only applicable to cluster-type of k8s")
endif
	NAMESPACE=$(NAMESPACE) ./script/generate-serving.sh

#---
#
#@ cluster-auth-client
#
#== Register hawtio as an additional oauth client allowing it to watch across the cluster
#
#=== Calls check-admin
#
#* PARAMETERS:
#** CLUSTER_TYPE:          Set the cluster type - must be openshift as not applicable to kubernetes
#** MODE:                  Set the mode of installation [ cluster | namespace ]
#
#---
cluster-auth-client: check-admin
ifneq ($(CLUSTER_TYPE), openshift)
	$(error "Only applicable to cluster-type of Openshift")
endif
ifneq ($(MODE), cluster)
	$(error "Only applicable to cluster mode")
endif
	./$(CLUSTER_TYPE)/$(MODE)/oauthclient.sh

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
#** CLUSTER_TYPE:     Set the cluster type to install on [ openshift | k8s ]
#** MODE:             Set the mode of installation [ cluster | namespace ]
#** NAMESPACE:        Set the namespace to uninstall the resources from
#** UNINSTALL_ALL:  Uninstall all resources including crds and cluster roles installed by setup-cluster [true|false]
#** DRY_RUN:        Print the resources to be applied instead of applying them [true|false]
#
#---
uninstall: kubectl kustomize
# Set the namespace in the all target kustomization yaml
	@$(call set-kustomize-namespace, $(CLUSTER_TYPE)/$(MODE))
ifeq ($(DRY_RUN), false)
	@$(KUSTOMIZE) build $(KOPTIONS) $(CLUSTER_TYPE)/$(MODE) | kubectl delete --ignore-not-found=true -f -
else
	@$(KUSTOMIZE) build $(KOPTIONS) $(CLUSTER_TYPE)/$(MODE) | kubectl delete --dry-run=client -f -
endif

.DEFAULT_GOAL := help
.PHONY: help
help: ## Show this help screen.
	@awk 'BEGIN { printf "\nUsage: make \033[31m<PARAM1=val1 PARAM2=val2>\033[0m \033[36m<target>\033[0m\n"; printf "\nAvailable targets are:\n" } /^#@/ { printf "\033[36m%-15s\033[0m", $$2; subdesc=0; next } /^#===/ { printf "%-14s \033[32m%s\033[0m\n", " ", substr($$0, 5); subdesc=1; next } /^#==/ { printf "\033[0m%s\033[0m\n\n", substr($$0, 4); next } /^#\*\*/ { printf "%-14s \033[31m%s\033[0m\n", " ", substr($$0, 4); next } /^#\*/ && (subdesc == 1) { printf "\n"; next } /^#\-\-\-/ { printf "\n"; next }' $(MAKEFILE_LIST)
