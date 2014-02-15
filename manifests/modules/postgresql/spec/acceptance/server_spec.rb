require 'spec_helper_acceptance'

describe 'server:' do
  after :all do
    # Cleanup after tests have ran
    apply_manifest("class { 'postgresql::server': ensure => absent }", :catch_failures => true)
  end

  it 'test loading class with no parameters' do
    pp = <<-EOS.unindent
      class { 'postgresql::server': }
    EOS

    apply_manifest(pp, :catch_failures => true)
    apply_manifest(pp, :catch_changes => true)
  end

  describe port(5432) do
    it { should be_listening }
  end

  describe 'setting postgres password' do
    it 'should install and successfully adjust the password' do
      pp = <<-EOS.unindent
        class { 'postgresql::server':
          postgres_password          => 'foobarbaz',
          ip_mask_deny_postgres_user => '0.0.0.0/32',
        }
      EOS

      apply_manifest(pp, :catch_failures => true) do |r|
        expect(r.stdout).to match(/\[set_postgres_postgrespw\]\/returns: executed successfully/)
      end
      apply_manifest(pp, :catch_changes => true)

      pp = <<-EOS.unindent
        class { 'postgresql::server':
          postgres_password          => 'TPSR$$eports!',
          ip_mask_deny_postgres_user => '0.0.0.0/32',
        }
      EOS

      apply_manifest(pp, :catch_failures => true) do |r|
        expect(r.stdout).to match(/\[set_postgres_postgrespw\]\/returns: executed successfully/)
      end
      apply_manifest(pp, :catch_changes => true)

    end
  end
end

describe 'server without defaults:' do
  before :all do
    pp = <<-EOS
      if($::operatingsystem =~ /Debian|Ubuntu/) {
        # Need to make sure the correct utf8 locale is ready for our
        # non-standard tests
        file { '/etc/locale.gen':
          content => "en_US ISO-8859-1\nen_NG UTF-8\nen_US UTF-8\n",
        }~>
        exec { '/usr/sbin/locale-gen':
          logoutput => true,
          refreshonly => true,
        }
      }
    EOS

    apply_manifest(pp, :catch_failures => true)
  end

  context 'test installing non-default version of postgresql' do
    after :all do
      psql('--command="drop database postgresql_test_db" postgres', 'postgres')
      pp = <<-EOS.unindent
        class { 'postgresql::globals':
          ensure              => absent,
          manage_package_repo => true,
          version             => '9.3',
        }
        class { 'postgresql::server':
          ensure => absent,
        }
      EOS
      apply_manifest(pp, :catch_failures => true)
    end

    it 'perform installation and create a db' do
      pp = <<-EOS.unindent
        class { "postgresql::globals":
          version             => "9.3",
          manage_package_repo => true,
          encoding            => 'UTF8',
          locale              => 'en_US.UTF-8',
          xlogdir             => '/tmp/pg_xlogs',
        }
        class { "postgresql::server": }
        postgresql::server::db { "postgresql_test_db":
          user     => "foo1",
          password => postgresql_password('foo1', 'foo1'),
        }
        postgresql::server::config_entry { 'port':
          value => '5432',
        }
      EOS

      apply_manifest(pp, :catch_failures => true)
      apply_manifest(pp, :catch_changes => true)

      shell('test -d /tmp/pg_xlogs') do |r|
        expect(r.stdout).to eq('')
        expect(r.stderr).to eq('')
      end

      psql('postgresql_test_db --command="select datname from pg_database limit 1"')
    end

    describe port(5432) do
      it { should be_listening }
    end
  end

  unless ((fact('osfamily') == 'RedHat' and fact('lsbmajdistrelease') == '5') ||
    fact('osfamily') == 'Debian')

    context 'override locale and encoding' do
      after :each do
        apply_manifest("class { 'postgresql::server': ensure => absent }", :catch_failures => true)
      end

      it 'perform installation with different locale and encoding' do
        pp = <<-EOS.unindent
          class { 'postgresql::server':
            locale   => 'en_NG',
            encoding => 'UTF8',
          }
        EOS

        apply_manifest(pp, :catch_failures => true)
        apply_manifest(pp, :catch_changes => true)

        # Remove db first, if it exists for some reason
        shell('su postgres -c "dropdb test1"', :acceptable_exit_codes => [0,1,2])
        shell('su postgres -c "createdb test1"')
        shell('su postgres -c \'psql -c "show lc_ctype" test1\'') do |r|
          expect(r.stdout).to match(/en_NG/)
        end

        shell('su postgres -c \'psql -c "show lc_collate" test1\'') do |r|
          expect(r.stdout).to match(/en_NG/)
        end
      end
    end
  end
end

describe 'server with firewall:' do
  after :all do
    apply_manifest("class { 'postgresql::server': ensure => absent }", :catch_failures => true)
  end

  context 'test installing postgresql with firewall management on' do
    it 'perform installation and make sure it is idempotent' do
      pending('no support for firewall with fedora', :if => (fact('operatingsystem') == 'Fedora'))
      pp = <<-EOS.unindent
        class { 'firewall': }
        class { "postgresql::server":
          manage_firewall => true,
        }
      EOS

      apply_manifest(pp, :catch_failures => true)
      apply_manifest(pp, :catch_changes => true)
    end
  end
end

describe 'server without pg_hba.conf:' do
  after :all do
    apply_manifest("class { 'postgresql::server': ensure => absent }", :catch_failures => true)
  end

  context 'test installing postgresql without pg_hba.conf management on' do
    it 'perform installation and make sure it is idempotent' do
      pp = <<-EOS.unindent
        class { "postgresql::server":
          manage_pg_hba_conf => false,
        }
      EOS

      apply_manifest(pp, :catch_failures => true)
      apply_manifest(pp, :catch_changes => true)
    end
  end
end
