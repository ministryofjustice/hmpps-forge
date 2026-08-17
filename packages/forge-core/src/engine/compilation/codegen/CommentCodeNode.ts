import GeneratedCodeNode from './GeneratedCodeNode'

export default class CommentCodeNode extends GeneratedCodeNode {
  constructor(
    private readonly commentText: string,
    private readonly bannerComment: boolean,
  ) {
    super()
  }

  get text(): string {
    return this.commentText
  }

  get banner(): boolean {
    return this.bannerComment
  }
}
