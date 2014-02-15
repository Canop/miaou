require 'spec_helper_system'

describe 'symbolic name' do
  pp = <<-EOS
    concat { 'not_abs_path':
      path => '/tmp/concat/file',
    }

    concat::fragment { '1':
      target  => 'not_abs_path',
      content => '1',
      order   => '01',
    }

    concat::fragment { '2':
      target  => 'not_abs_path',
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
    it { should contain '1' }
    it { should contain '2' }
  end
end
