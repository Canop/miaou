Exec { path => [ '/bin/', '/sbin/' , '/usr/bin/', '/usr/sbin/' ] }

class system-update {
    exec { 'apt-get update':
        command => 'apt-get update',
    }
}

class nodejs-ppa {
    include apt

    apt::ppa { 'ppa:chris-lea/node.js': }
}

class nodejs {
    include system-update
    include nodejs-ppa

    package { 'nodejs':
        ensure => present,
        require => Class['nodejs-ppa', 'system-update']
    }
}

class { 'postgresql::globals':
    version => '9.3',
    manage_package_repo => true
}

postgresql::server::pg_hba_rule { 'allow anyone to use miaou':
    type => 'local',
    database => 'miaou',
    user => 'miaou_user',
    auth_method => 'md5'
}

class postgres {
    include postgresql::server

    postgresql::server::db { 'miaou':
        user => 'miaou_user',
        password => postgresql_password('miaou_user', 'password')
    }

}

class postgres-dev {
    package { 'postgresql-server-dev-9.3':
        ensure => present,
        require => Class['init_db']
    }
}

class init_db {
    exec { 'create db structure':
        environment => [ 'PGPASSWORD=password' ],
        command => 'psql -h localhost -U miaou_user -d miaou -a -f /vagrant/sql/postgres.creation.sql',
        require => Class['postgres']
    }
}

class init_miaou {
    include postgres-dev

    exec { 'npm install':
        path => ['/bin/', '/sbin/', '/usr/bin/', '/usr/sbin/', '/usr/local/bin/'],
        command => '/bin/bash -c "cd /vagrant/; npm install"',
        require => Class['nodejs', 'postgres', 'postgres-dev']
    }
}

include nodejs
include postgres
include redis
include init_db
include init_miaou
