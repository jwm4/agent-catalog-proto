import { useParams, Link } from 'react-router-dom';
import Markdown from 'react-markdown';
import {
  Breadcrumb,
  BreadcrumbItem,
  Button,
  Card,
  CardBody,
  CardTitle,
  Content,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  EmptyState,
  EmptyStateBody,
  Flex,
  FlexItem,
  Grid,
  GridItem,
  Label,
  PageSection,
} from '@patternfly/react-core';
import {
  CubeIcon,
  ExternalLinkAltIcon,
  GithubIcon,
} from '@patternfly/react-icons';
import { getHarnessById } from '@client/data/harnesses';

export function DetailPage() {
  const { id } = useParams<{ id: string }>();
  const harness = id ? getHarnessById(id) : undefined;

  if (!harness) {
    return (
      <PageSection hasBodyWrapper={false}>
        <EmptyState titleText="Agent not found" headingLevel="h1">
          <EmptyStateBody>
            No agent with ID &quot;{id}&quot; exists in the catalog.
          </EmptyStateBody>
          <Link to="/">
            <Button variant="primary">Back to catalog</Button>
          </Link>
        </EmptyState>
      </PageSection>
    );
  }

  return (
    <>
      <PageSection hasBodyWrapper={false}>
        <Breadcrumb>
          <BreadcrumbItem>
            <Link to="/">Agent catalog</Link>
          </BreadcrumbItem>
          <BreadcrumbItem isActive>{harness.name}</BreadcrumbItem>
        </Breadcrumb>
      </PageSection>

      <PageSection hasBodyWrapper={false}>
        <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }}>
          <FlexItem>
            <Flex
              alignItems={{ default: 'alignItemsCenter' }}
              spaceItems={{ default: 'spaceItemsMd' }}
            >
              <FlexItem>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--pf-t--global--background--color--secondary--default)',
                    border: '1px solid var(--pf-t--global--border--color--default)',
                    fontSize: '20px',
                  }}
                >
                  <CubeIcon />
                </span>
              </FlexItem>
              <FlexItem>
                <Content component="h1" style={{ marginBottom: 0 }}>
                  {harness.name}
                </Content>
              </FlexItem>
              <FlexItem>
                <Label isCompact variant="outline">Starter kit</Label>
              </FlexItem>
            </Flex>
          </FlexItem>
          <FlexItem>
            <Flex spaceItems={{ default: 'spaceItemsSm' }}>
              <FlexItem>
                <Link to={`/agents/${harness.id}/customize`}>
                  <Button variant="primary">Customize and Deploy</Button>
                </Link>
              </FlexItem>
              <FlexItem>
                <Button
                  variant="secondary"
                  icon={<ExternalLinkAltIcon />}
                  iconPosition="start"
                  component="a"
                  href={harness.documentationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open GitHub
                </Button>
              </FlexItem>
            </Flex>
          </FlexItem>
        </Flex>
      </PageSection>

      <PageSection hasBodyWrapper={false}>
        <Grid hasGutter>
          <GridItem span={9}>
            <Card>
              <CardTitle>Description</CardTitle>
              <CardBody>
                <Content component="p">{harness.longDescription}</Content>
              </CardBody>
            </Card>

            <Card style={{ marginTop: '16px' }}>
              <CardTitle>
                <Flex
                  alignItems={{ default: 'alignItemsCenter' }}
                  spaceItems={{ default: 'spaceItemsSm' }}
                >
                  <FlexItem>
                    <GithubIcon />
                  </FlexItem>
                  <FlexItem>README</FlexItem>
                </Flex>
              </CardTitle>
              <CardBody>
                <div className="pf-v6-c-content">
                  <Markdown>{harness.readme}</Markdown>
                </div>
              </CardBody>
            </Card>
          </GridItem>

          <GridItem span={3}>
            <Card>
              <CardTitle>Details</CardTitle>
              <CardBody>
                <DescriptionList>
                  <DescriptionListGroup>
                    <DescriptionListTerm>Labels</DescriptionListTerm>
                    <DescriptionListDescription>
                      {harness.tags.map((tag) => (
                        <Label
                          key={tag}
                          isCompact
                          variant="outline"
                          style={{ marginRight: '4px', marginBottom: '4px' }}
                        >
                          {tag}
                        </Label>
                      ))}
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                  <DescriptionListGroup>
                    <DescriptionListTerm>Framework</DescriptionListTerm>
                    <DescriptionListDescription>
                      {harness.name}
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                  <DescriptionListGroup>
                    <DescriptionListTerm>Agent type</DescriptionListTerm>
                    <DescriptionListDescription>
                      Starter kit
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                  <DescriptionListGroup>
                    <DescriptionListTerm>Models</DescriptionListTerm>
                    <DescriptionListDescription>
                      {harness.backends.map((b) => (
                        <Label
                          key={b.id}
                          isCompact
                          variant="outline"
                          style={{ marginRight: '4px' }}
                        >
                          {b.name}
                        </Label>
                      ))}
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                </DescriptionList>
              </CardBody>
            </Card>
          </GridItem>
        </Grid>
      </PageSection>
    </>
  );
}
