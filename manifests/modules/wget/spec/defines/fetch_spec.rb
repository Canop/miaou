require 'spec_helper'

describe 'wget::fetch' do
  let(:title) { 'test' }
  let(:facts) {{}}

  let(:params) {{
    :source      => 'http://localhost/source',
    :destination => destination,
  }}

  let(:destination) { "/tmp/dest" }

  context "with default params" do
    it { should contain_exec('wget-test').with({
      'command' => "wget --no-verbose --output-document='#{destination}' 'http://localhost/source'",
      'environment' => []
    }) }
  end

  context "with user" do
    let(:params) { super().merge({
      :execuser => 'testuser',
    })}

    it { should contain_exec('wget-test').with({
      'command' => "wget --no-verbose --output-document='#{destination}' 'http://localhost/source'",
      'user' => 'testuser',
      'environment' => []
    }) }
  end

  context "with authentication" do
    let(:params) { super().merge({
      :user => 'myuser',
      :password => 'mypassword'
    })}

    context "with default params" do
      it { should contain_exec('wget-test').with({
        'command'     => "wget --no-verbose --user=myuser --output-document='#{destination}' 'http://localhost/source'",
        'environment' => "WGETRC=#{destination}.wgetrc"
        })
      }
      it { should contain_file("#{destination}.wgetrc").with_content('password=mypassword') }
    end

    context "with user" do
      let(:params) { super().merge({
        :execuser => 'testuser',
      })}

      it { should contain_exec('wget-test').with({
        'command' => "wget --no-verbose --user=myuser --output-document='#{destination}' 'http://localhost/source'",
        'user' => 'testuser',
        'environment' => "WGETRC=#{destination}.wgetrc"
      }) }
    end

    context "using proxy" do
      let(:facts) { super().merge({
        :http_proxy => 'http://proxy:1000',
        :https_proxy => 'http://proxy:1000'
      }) }
      it { should contain_exec('wget-test').with({
        'command'     => "wget --no-verbose --user=myuser --output-document='#{destination}' 'http://localhost/source'",
        'environment' => ["HTTP_PROXY=http://proxy:1000", "http_proxy=http://proxy:1000", "HTTPS_PROXY=http://proxy:1000", "https_proxy=http://proxy:1000", "WGETRC=#{destination}.wgetrc"]
        })
      }
      it { should contain_file("#{destination}.wgetrc").with_content('password=mypassword') }
    end
  end

end
