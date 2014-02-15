require 'spec_helper'

describe 'wget' do

  context 'running on OS X' do
    let(:facts) { {:operatingsystem => 'Darwin'} }

    it { should_not contain_package('wget') }
  end

  context 'running on CentOS' do
    let(:facts) { {:operatingsystem => 'CentOS'} }

    it { should contain_package('wget') }
  end

  context 'no version specified' do
    it { should contain_package('wget').with_ensure('present') }
  end

  context 'version is 1.2.3' do
    let(:params) { {:version => '1.2.3'} }

    it { should contain_package('wget').with_ensure('1.2.3') }
  end
end
