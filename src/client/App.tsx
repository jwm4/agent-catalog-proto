import {
  Page,
  Masthead,
  MastheadMain,
  MastheadBrand,
  PageSection,
  Content,
} from '@patternfly/react-core';

export function App() {
  return (
    <Page
      masthead={
        <Masthead>
          <MastheadMain>
            <MastheadBrand>Agent Catalog</MastheadBrand>
          </MastheadMain>
        </Masthead>
      }
    >
      <PageSection>
        <Content>
          <h1>Agent Catalog</h1>
          <p>Prototype is running. Start building from here.</p>
        </Content>
      </PageSection>
    </Page>
  );
}
