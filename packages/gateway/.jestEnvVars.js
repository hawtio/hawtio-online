// Ensure the tests can find the ACL yaml file
process.env.HAWTIO_ONLINE_RBAC_ACL = `${__dirname}/public/ACL.yaml`

// Set the WEB_PORT before we import the gateway server
process.env.WEB_PORT = '60002'
