# Releasing Hawtio Online

To release a new Hawtio Online version:

- [ ] update the version of @hawtio/online workspace package:
```
yarn workspace @hawtio/online-shell version
```
- [ ] Update the VERSION variable in the `Makefile`
- [ ] Update the website with the latest version information
- [ ] Update the documentation
- [ ] Commit the changes
- [ ] Tag the commit with the version
- [ ] Push the changes to the version.x branch
```
git push origin main --tags
```
