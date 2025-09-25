{{/*
  Hawtio-Online app labels
  - Parameter: value of the label
*/}}
{{- define "hawtio-online.app.labels" -}}
app: {{ .shortname }}
deployment: {{ .name }}
app.kubernetes.io/part-of: {{ .application }}
app.kubernetes.io/managed-by: Helm
{{- end }}

{{/*
  Hawtio-Online app selector
  - Parameter: value of the label
*/}}
{{- define "hawtio-online.app.selector" -}}
app: {{ .shortname }}
deployment: {{ .name }}
{{- end }}

{{/*
  Hawtio-Online use SSL
  - parameters:
   - value if true
   - value if false
*/}}
{{- define "hawtio-online.use.ssl" -}}
{{- if or (eq .clusterType "openshift") (eq .internalSSL true) }}
true
{{- else }}
{{- end }}
{{- end }}

{{/*
  Hawtio-Online Service Port
*/}}
{{- define "hawtio-online.service.port" -}}
{{- ternary .online.service.ssl.port .online.service.plain.port (include "hawtio-online.use.ssl" . | not | empty) }}
{{- end }}

{{/*
  Hawtio-Online Deployment Port
*/}}
{{- define "hawtio-online.deployment.port" -}}
{{- ternary .online.deployment.ssl.port .online.deployment.plain.port (include "hawtio-online.use.ssl" . | not | empty) }}
{{- end }}

{{/*
  Hawtio-Online Deployment Scheme
*/}}
{{- define "hawtio-online.deployment.scheme" -}}
{{- ternary .online.deployment.ssl.scheme .online.deployment.plain.scheme (include "hawtio-online.use.ssl" . | not | empty) }}
{{- end }}

{{/*
  Generate on OpenShift the proxying certificate to access the jolokia pods
  - Looks up the signing Certifcate Authority in the cluster
  - Extracts the key and certificate from the CA
  - Builds a custom certificate to convert the CA to a Certificate Object
  - Generates a new proxy certificate signed by the CA
  - Outputs the proxy certificate's key and certificate as tls.key and tls.crt respectively
*/}}
{{- define "hawtio-online.proxy.gen-cert" -}}
{{- $caSecret := (lookup "v1" "Secret" "openshift-service-ca" "signing-key") }}
{{- if not $caSecret }}
{{- fail "Error: OCP signing-key is required" }}
{{- end }}
{{- $caKey := (index $caSecret.data "tls.key") }}
{{- if not $caKey }}
{{- fail "Error: OCP signing-key tls.key is required" }}
{{- end }}
{{- $caCert := (index $caSecret.data "tls.crt") }}
{{- if not $caCert }}
{{- fail "Error: OCP signing-key tls.crt is required" }}
{{- end }}
{{- $ca := buildCustomCert $caCert $caKey }}
{{- $cert := (genSignedCert "hawtio-online.hawtio.svc" nil nil 365 $ca) -}}
{{ (print "tls.key: " ($cert.Key | b64enc)) | indent 2 }}
{{ (print "tls.crt: " ($cert.Cert | b64enc)) | indent 2 }}
{{- end }}

{{/*
  Generate a self-signed serving certificate for https access to
  hawtio-online. Applicable to non-OpenShift clusters (kubernetes)
  - Generates a private key
  - Generates the Certificate
*/}}
{{- define "hawtio-online.serving.gen-cert" -}}
{{- $cert := (genSelfSignedCert .Values.online.ingress.host nil nil 365) -}}
{{ (print "tls.key: " ($cert.Key | b64enc)) | indent 2 }}
{{ (print "tls.crt: " ($cert.Cert | b64enc)) | indent 2 }}
{{- end }}
