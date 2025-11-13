.PHONY: deploy-valtown help

help:
	@echo "Available commands:"
	@echo "  make deploy-valtown    - Deploy to Val Town (vt push) and upload Root Zone DB file to blob storage"

deploy-valtown:
	@echo "Deploying to Val Town..."
	vt push
	@echo ""
	@echo "Uploading Root Zone DB file to Val Town blob storage..."
	deno task cli --val-town-upload-blob
	@echo ""
	@echo "✓ Deployment complete!"
