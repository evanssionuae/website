.PHONY: dev build prod
build:
	node build.js
dev: build
	@echo "Open http://localhost:8080"
	cd dist && python3 -m http.server 8080
prod:
	node build.js --prod
