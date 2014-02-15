require 'spec_helper_system'

describe 'replacement of' do
  context 'file' do
    context 'should not succeed' do
      before(:all) do
        shell('mkdir /tmp/concat')
        shell('echo "file exists" > /tmp/concat/file')
      end
      after(:all) do
        shell('rm -rf /tmp/concat /var/lib/puppet/concat')
      end

      pp = <<-EOS
        concat { '/tmp/concat/file':
          replace => false,
        }

        concat::fragment { '1':
          target  => '/tmp/concat/file',
          content => '1',
        }

        concat::fragment { '2':
          target  => '/tmp/concat/file',
          content => '2',
        }
      EOS

      context puppet_apply(pp) do
        its(:stderr) { should be_empty }
        its(:exit_code) { should_not == 1 }
        its(:refresh) { should be_nil }
        its(:stderr) { should be_empty }
        its(:exit_code) { should be_zero }
      end

      describe file('/tmp/concat/file') do
        it { should be_file }
        it { should contain 'file exists' }
        it { should_not contain '1' }
        it { should_not contain '2' }
      end
    end

    context 'should succeed' do
      before(:all) do
        shell('mkdir /tmp/concat')
        shell('echo "file exists" > /tmp/concat/file')
      end
      after(:all) do
        shell('rm -rf /tmp/concat /var/lib/puppet/concat')
      end

      pp = <<-EOS
        concat { '/tmp/concat/file':
          replace => true,
        }

        concat::fragment { '1':
          target  => '/tmp/concat/file',
          content => '1',
        }

        concat::fragment { '2':
          target  => '/tmp/concat/file',
          content => '2',
        }
      EOS

      context puppet_apply(pp) do
        its(:stderr) { should be_empty }
        its(:exit_code) { should_not == 1 }
        its(:refresh) { should be_nil }
        its(:stderr) { should be_empty }
        its(:exit_code) { should be_zero }
      end

      describe file('/tmp/concat/file') do
        it { should be_file }
        it { should_not contain 'file exists' }
        it { should contain '1' }
        it { should contain '2' }
      end
    end
  end # file

  context 'symlink' do
    context 'should not succeed' do
      # XXX the core puppet file type will replace a symlink with a plain file
      # when using ensure => present and source => ... but it will not when using
      # ensure => present and content => ...; this is somewhat confusing behavior
      before(:all) do
        shell('mkdir /tmp/concat')
        shell('ln -s /tmp/concat/dangling /tmp/concat/file')
      end
      after(:all) do
        shell('rm -rf /tmp/concat /var/lib/puppet/concat')
      end

      pp = <<-EOS
        concat { '/tmp/concat/file':
          replace => false,
        }

        concat::fragment { '1':
          target  => '/tmp/concat/file',
          content => '1',
        }

        concat::fragment { '2':
          target  => '/tmp/concat/file',
          content => '2',
        }
      EOS

      context puppet_apply(pp) do
        its(:stderr) { should be_empty }
        its(:exit_code) { should_not == 1 }
        its(:refresh) { should be_nil }
        its(:stderr) { should be_empty }
        its(:exit_code) { should be_zero }
      end

      describe file('/tmp/concat/file') do
        it { should be_linked_to '/tmp/concat/dangling' }
      end

      describe file('/tmp/concat/dangling') do
        # XXX serverspec does not have a matcher for 'exists'
        it { should_not be_file }
        it { should_not be_directory }
      end
    end

    context 'should succeed' do
      # XXX the core puppet file type will replace a symlink with a plain file
      # when using ensure => present and source => ... but it will not when using
      # ensure => present and content => ...; this is somewhat confusing behavior
      before(:all) do
        shell('mkdir /tmp/concat')
        shell('ln -s /tmp/concat/dangling /tmp/concat/file')
      end
      after(:all) do
        shell('rm -rf /tmp/concat /var/lib/puppet/concat')
      end

      pp = <<-EOS
        concat { '/tmp/concat/file':
          replace => true,
        }

        concat::fragment { '1':
          target  => '/tmp/concat/file',
          content => '1',
        }

        concat::fragment { '2':
          target  => '/tmp/concat/file',
          content => '2',
        }
      EOS

      context puppet_apply(pp) do
        its(:stderr) { should be_empty }
        its(:exit_code) { should_not == 1 }
        its(:refresh) { should be_nil }
        its(:stderr) { should be_empty }
        its(:exit_code) { should be_zero }
      end

      describe file('/tmp/concat/file') do
        it { should be_file }
        it { should contain '1' }
        it { should contain '2' }
      end
    end
  end # symlink

  context 'directory' do
    context 'should not succeed' do
      before(:all) do
        shell('mkdir -p /tmp/concat/file')
      end
      after(:all) do
        shell('rm -rf /tmp/concat /var/lib/puppet/concat')
      end

      pp = <<-EOS
        concat { '/tmp/concat/file': }

        concat::fragment { '1':
          target  => '/tmp/concat/file',
          content => '1',
        }

        concat::fragment { '2':
          target  => '/tmp/concat/file',
          content => '2',
        }
      EOS

      context puppet_apply(pp) do
        its(:stderr) { should =~ /change from directory to file failed/ }
        its(:exit_code) { should_not == 1 }
        its(:refresh) { should be_nil }
        its(:stderr) { should =~ /change from directory to file failed/ }
        its(:exit_code) { should_not == 1 }
      end

      describe file('/tmp/concat/file') do
        it { should be_directory }
      end
    end

    # XXX concat's force param currently enables the creation of empty files when
    # there are no fragments.  The semantics either need to be changed, extended,
    # or a new param introduced to control directory replacement.
    context 'should succeed', :pending => 'not yet implemented' do
      before(:all) do
        shell('mkdir -p /tmp/concat/file')
      end
      after(:all) do
        shell('rm -rf /tmp/concat /var/lib/puppet/concat')
      end

      pp = <<-EOS
        concat { '/tmp/concat/file':
          force => true,
        }

        concat::fragment { '1':
          target  => '/tmp/concat/file',
          content => '1',
        }

        concat::fragment { '2':
          target  => '/tmp/concat/file',
          content => '2',
        }
      EOS

      context puppet_apply(pp) do
        its(:stderr) { should be_empty }
        its(:exit_code) { should_not == 1 }
        its(:refresh) { should be_nil }
        its(:stderr) { should be_empty }
        its(:exit_code) { should be_zero }
      end

      describe file('/tmp/concat/file') do
        it { should be_file }
        it { should contain '1' }
      end
    end
  end # directory
end
