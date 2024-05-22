cd 
mkdir pokerimdb pokerdb pokerlog pokerFinancedb pokerAdminDb pokerTournamentDb -p
mongod --bind_ip_all --storageEngine inMemory --dbpath "./pokerimdb" --port 28001 &
echo '============   Cache database (inMemory) started ============'
mongod --bind_ip_all --storageEngine wiredTiger --dbpath "./pokerdb" --port 28002 &
echo '============   Main database (wiredTiger) started ============'
mongod --bind_ip_all --storageEngine wiredTiger --dbpath "./pokerlog" --port 28003 &
echo '============   Video Log database (wiredTiger) started ============'
mongod --bind_ip_all --storageEngine wiredTiger --dbpath "./pokerFinancedb" --port 28004 &
echo '============  Finance database (wiredTiger) started ============'
mongod --bind_ip_all --storageEngine wiredTiger --dbpath "./pokerAdminDb" --port 28005 &
echo '============  Admin database (wiredTiger) started ============'
mongod --bind_ip_all --bind_ip_all --storageEngine wiredTiger --dbpath "./pokerTournamentDb" --port 28011 &
echo '============  Poker Tournament database (wiredTiger) started ============'

