Miaou development environment using Docker
===



## Requirements

### Linux

 - [Docker and Docker Compose](https://docs.docker.com/engine/installation/linux/)

### Windows

 - [Docker and Docker Compose](https://docs.docker.com/engine/installation/windows/)

### Mac OS X

 - [Docker and Docker Compose](https://docs.docker.com/engine/installation/mac/)



## How to use?

### First time (assuming you already cloned Miaou)

 1. Choose which hostname Miaou will use, then copy `docker/miaou-default.env` to `docker/miaou.env` and set the value of `MIAOU_HOST` to the hostname you chose, in this new file.

    Note: In this documentation, we will assume that your `MIAOU_HOST` value is `miaou.dev`, so when you'll see "miaou.dev", replace it by the hostname you chose.

 2. Copy the `docker/config.js` preconfigured file to the root of the Miaou sources.

 3. To be able to log in Miaou, you have to set a OAuth provider (here we'll use Google which is really easy to configure, assuming you have a Google account).

    First, go to `https://console.developers.google.com/project`, create a new project, then go to `Credentials` to create new `OAuth client ID`.

    Select `Web application` as *Application type*, set `http://miaou.dev` as *Authorized Javascript origins* and `http://miaou.dev/auth/google/callback` as *Authorized redirect URIs*.

    Now you'll be given a *Client ID* and a *Client secret* that you'll have to copy/paste in your new `config.js` file.

 4. Prebuild Miaou:
 
    ```bash
    docker-compose up -d
    ```

 5. Now you should have `postgres` and `redis` up and running, but Miaou should have failed to start because you still did not build the database.

    To do so, you'll have to go to the `postgres` container (which should be named `miaou_postgres_1`) in order to be able to run SQL commands:

    ```bash
    docker exec -it miaou_postgres_1 psql -U miaou -w
    ```

    Now that you have a prompt for `miaou` psql user, copy/paste the content of the SQL creation file located at `sql/postgres.creation.sql`, then exit the container with `\q`.

 6. Since you now have a working database, restart Miaou:

    ```bash
    docker-compose up -d
    ```

    Now you should see your Miaou application running in your host browser at `http://miaou.dev`.

### Second time and more

```bash
# Build miaou application with a fresh copy of local sources
docker-compose up -d --build
```

### Running tests

```bash
# Start miaou
docker-compose up -d
# Exec bash in miaou container
docker exec -it miaou_miaou_1 bash
# Run test in miaou container
sh test.sh
```

OR

```bash
# Start miaou
docker-compose up -d
# Run test in miaou container
docker exec -it miaou_miaou_1 sh test.sh
```

### Get Miaou logs

```bash
# Start miaou
docker-compose up -d
# Get miaou container logs in real time
docker logs -f miaou_miaou_1
```

### Restart application on file changes

If you don't want to rebuild Miaou each time you update a file, open `docker-compose.yml` file and uncomment the `command` and `volumes` keys of the `miaou` service.

Then run `docker-compose up -d` to create a container which will start Miaou using `nodemon` to watch the given volumes and restart the application accordingly.
