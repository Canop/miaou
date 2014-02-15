require 'spec_helper_system'

describe 'concat warn =>' do
  context 'true should enable default warning message' do
    pp = <<-EOS
      concat { '/tmp/concat/file':
        warn  => true,
      }

      concat::fragment { '1':
        target  => '/tmp/concat/file',
        content => '1',
        order   => '01',
      }

      concat::fragment { '2':
        target  => '/tmp/concat/file',
        content => '2',
        order   => '02',
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
      it { should contain '# This file is managed by Puppet. DO NOT EDIT.' }
      it { should contain '1' }
      it { should contain '2' }
    end
  end
  context 'false should not enable default warning message' do
    pp = <<-EOS
      concat { '/tmp/concat/file':
        warn  => false,
      }

      concat::fragment { '1':
        target  => '/tmp/concat/file',
        content => '1',
        order   => '01',
      }

      concat::fragment { '2':
        target  => '/tmp/concat/file',
        content => '2',
        order   => '02',
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
      it { should_not contain '# This file is managed by Puppet. DO NOT EDIT.' }
      it { should contain '1' }
      it { should contain '2' }
    end
  end
  context '# foo should overide default warning message' do
    pp = <<-EOS
      concat { '/tmp/concat/file':
        warn  => '# foo',
      }

      concat::fragment { '1':
        target  => '/tmp/concat/file',
        content => '1',
        order   => '01',
      }

      concat::fragment { '2':
        target  => '/tmp/concat/file',
        content => '2',
        order   => '02',
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
      it { should contain '# foo' }
      it { should contain '1' }
      it { should contain '2' }
    end
  end
end
