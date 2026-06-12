@echo off
echo Setting Railway environment variables...

railway variables set FLIPOPS_API_KEY=fo_live_10177805c8d743e1a6e1860515dc2b3f --service flipops-api --environment production
railway variables set FO_API_KEY=fo_live_10177805c8d743e1a6e1860515dc2b3f --service flipops-api --environment production
railway variables set FO_WEBHOOK_SECRET=7d82e2b8945c43959699bc3a3c1467bdd66954d25d6f41eb --service flipops-api --environment production
railway variables set NEXT_PUBLIC_ENABLE_DATASOURCE_PANELS=1 --service flipops-api --environment production
railway variables set NODE_ENV=production --service flipops-api --environment production
railway variables set PORT=3000 --service flipops-api --environment production

echo All environment variables have been set!
echo Redeploying service...
railway up --service flipops-api --environment production