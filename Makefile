.PHONY: help
help:
	@echo "Available commands:"
	@echo "  make test              - Run all tests"
	@echo "  make build-tlds-json   - Build the enhanced tlds.json file from IANA data sources"
	@echo "  make deploy-valtown    - Deploy to Val Town (vt push) and upload Root Zone DB file to blob storage"

.PHONY: test
test:
	@echo "Running tests…"
	deno task test

.PHONY: build-tlds-json
build-tlds-json:
	@echo "Building tlds.json…"
	deno task build

.PHONY: download-data
download-data:
	@echo "Downloading all data files…"
	deno task cli --download

.PHONY: deploy-valtown
deploy-valtown:
	@echo "Deploying to Val Town..."
	vt push
	@echo ""
	@echo "Uploading Root Zone DB file to Val Town blob storage..."
	deno task cli --val-town-upload-blob
	@echo ""
	@echo "✓ Deployment complete!"
