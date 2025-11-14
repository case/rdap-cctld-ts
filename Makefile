.PHONY: deploy-valtown build-tlds-json help

help:
	@echo "Available commands:"
	@echo "  make build-tlds-json   - Build the enhanced tlds.json file from IANA data sources"
	@echo "  make deploy-valtown    - Deploy to Val Town (vt push) and upload Root Zone DB file to blob storage"

build-tlds-json:
	@echo "Building tlds.json..."
	deno task build

deploy-valtown:
	@echo "Deploying to Val Town..."
	vt push
	@echo ""
	@echo "Uploading Root Zone DB file to Val Town blob storage..."
	deno task cli --val-town-upload-blob
	@echo ""
	@echo "✓ Deployment complete!"
