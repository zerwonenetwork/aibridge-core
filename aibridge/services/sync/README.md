# Sync Layer Boundary

Sync service responsibilities:

- watch `.aibridge/` for local changes
- push updates to cloud
- pull remote updates from devices/teammates
- resolve merge conflicts deterministically
- maintain encryption + integrity guarantees
