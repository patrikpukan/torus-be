import { GraphQLScalarType } from "graphql";

const GraphQLUpload = new GraphQLScalarType({
  name: "Upload",
  description: "Mock Upload scalar for e2e tests",
  serialize: (value: unknown) => value,
  parseValue: (value: unknown) => value,
  parseLiteral: () => null,
});

export default GraphQLUpload;
